/* =====================================================================
   WORKER DE LA WEB · Hotel Frontera · Restaurante Las Margaritas
   (Cloudflare Workers con archivos estáticos)

   Los archivos de la web los sirve Cloudflare directamente. Este código solo
   atiende:
     GET  /api/menu             (público) la carta con los precios cambiados en la web
     GET  /api/precios-web      (público) precios cambiados en la web que falta pasar
                                al menú QR; lo usa publicar.command
     GET  /precios/api/estado   (Access) datos para el editor de precios
     PUT  /precios/api/precios  (Access) guardar precios
     PUT  /precios/api/acceso   (Access) agregar o quitar correos con acceso

   Seguridad:
   - /precios/* está detrás de Cloudflare Access: el código al correo prueba que la
     persona es dueña del correo. Aquí se verifica el JWT de Access (firma RS256,
     emisor, audiencia, vigencia) y que el correo tenga permiso: el dueño
     (CORREO_DUENO) o alguien que agregó una persona con acceso. Sin dueño
     configurado no entra nadie (falla cerrado).
   - Escrituras: solo JSON, mismo origen (Origin y Sec-Fetch-Site) → sin CSRF.
   - Solo cambian números de precio de productos que existen, enteros de 0 a 1 000 000.
   - Concurrencia: versión del Durable Object; si otra persona guardó antes, 409.
     El permiso se vuelve a comprobar dentro del Durable Object al guardar.
   - Registro: quién, cuándo y qué cambió (precios y correos).
   Variables (en Cloudflare, como «secretos»): ACCESS_EQUIPO, ACCESS_AUD, CORREO_DUENO.
   ===================================================================== */
import { DurableObject } from "cloudflare:workers";
import {
  ErrorPeticion, ErrorAcceso, leerMenuJS, indexarPrecios, pendientesVigentes, menuEnVivo,
  validarCambios, normalizarEstado, aplicarEnEstado, verificarAcceso, normalizarAcceso,
  listaCorreos, rolDe, cambiarAcceso, vistaAcceso,
} from "./logica.js";

const MAX_CUERPO = 64 * 1024;
const RUTAS_API = new Set(["/api/menu", "/api/precios-web", "/precios/api/estado", "/precios/api/precios", "/precios/api/acceso"]);
const CACHE_MENU_S = 60;        // la carta pública: el precio nuevo se ve en un minuto como mucho
const CACHE_PRECIOS_WEB_S = 5;  // lo que lee publicar.command: casi al día

/* ---------- Caché en memoria para las rutas públicas ----------
   En *.workers.dev la caché de Cloudflare (Cache API) no funciona, así que cada copia
   del Worker guarda la respuesta unos segundos. Así, pedir /api/menu mil veces no gasta
   el almacenamiento. Al guardar precios se vacía la de esa copia; las demás vencen solas. */
const memoria = new WeakMap();   // env -> Map(ruta -> { hasta, cuerpo })
export function olvidarCache(env) { memoria.delete(env); }
async function enMemoria(env, ruta, segundos, calcular) {
  let rutas = memoria.get(env);
  if (!rutas) { rutas = new Map(); memoria.set(env, rutas); }
  const guardada = rutas.get(ruta);
  if (guardada && guardada.hasta > Date.now()) return guardada.cuerpo;
  const cuerpo = await calcular();
  rutas.set(ruta, { hasta: Date.now() + segundos * 1000, cuerpo });
  return cuerpo;
}

const BASE_SEGURA = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000",
};

function json(estado, datos, { cache = "no-store", extra = {} } = {}) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { ...BASE_SEGURA, "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, ...extra },
  });
}

/* ---------- Durable Object: precios cambiados en la web y su registro ---------- */
export class Precios extends DurableObject {
  async leer() {
    return normalizarEstado(await this.ctx.storage.get("estado"));
  }

  async leerTodo() {
    const [estado, acceso] = await Promise.all([this.ctx.storage.get("estado"), this.ctx.storage.get("acceso")]);
    return { estado: normalizarEstado(estado), acceso: normalizarAcceso(acceso) };
  }

  /** Atómico: dentro de un Durable Object no se intercalan dos guardados. */
  async guardar(versionBase, cambios, precios, quien, duenos) {
    const acceso = normalizarAcceso(await this.ctx.storage.get("acceso"));
    if (!rolDe(quien, acceso, duenos)) return { prohibido: true };   // lo quitaron mientras editaba
    const estado = normalizarEstado(await this.ctx.storage.get("estado"));
    if (versionBase !== estado.version) return { conflicto: true, estado };
    const nuevo = aplicarEnEstado(estado, cambios, new Map(precios), quien, Date.now());
    await this.ctx.storage.put("estado", nuevo);
    return { conflicto: false, estado: nuevo };
  }

  /** Agregar o quitar un correo (o terminar el primer inicio), comprobando el permiso aquí mismo. */
  async cambiarAcceso(cambio, quien, duenos) {
    const acceso = normalizarAcceso(await this.ctx.storage.get("acceso"));
    try {
      const nuevo = cambiarAcceso(acceso, cambio, quien, duenos, Date.now());
      await this.ctx.storage.put("acceso", nuevo);
      return { acceso: nuevo };
    } catch (e) {
      if (e instanceof ErrorPeticion) return { error: { estado: e.estado, cuerpo: e.cuerpo } };
      throw e;
    }
  }
}

const almacen = (env) => env.PRECIOS.get(env.PRECIOS.idFromName("menu"));

async function menuPublicado(env, url) {
  const r = await env.ASSETS.fetch(new Request(new URL("/menu-datos.js", url)));
  if (!r.ok) throw new ErrorPeticion(500, "menu", "No se encontró el menú publicado.");
  return leerMenuJS(await r.text());
}

/* ---------- Claves públicas de Access (se guardan 10 minutos en memoria) ---------- */
let clavesAccess = { equipo: "", hasta: 0, leidas: 0, keys: [] };
async function clavesDe(equipo, refrescar) {
  const ahora = Date.now();
  const vigentes = clavesAccess.equipo === equipo && clavesAccess.hasta > ahora;
  // Una clave desconocida obliga a releer (rotación), pero como mucho cada 30 s
  if (vigentes && (!refrescar || ahora - clavesAccess.leidas < 30000)) return clavesAccess.keys;
  const r = await fetch(`https://${equipo}.cloudflareaccess.com/cdn-cgi/access/certs`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new ErrorAcceso("No se pudieron leer las claves de Access.");
  const datos = await r.json();
  const keys = Array.isArray(datos && datos.keys) ? datos.keys : [];
  clavesAccess = { equipo, hasta: ahora + 10 * 60 * 1000, leidas: ahora, keys };
  return keys;
}

/** Sesión de Access válida (no dice nada del permiso). Devuelve el correo. */
async function exigirSesion(request, env) {
  try {
    if (!listaCorreos(env.CORREO_DUENO).length) throw new ErrorAcceso("Falta CORREO_DUENO.");
    const carga = await verificarAcceso(request.headers.get("Cf-Access-Jwt-Assertion"), {
      equipo: String(env.ACCESS_EQUIPO || "").trim(), aud: String(env.ACCESS_AUD || "").trim(),
      obtenerClaves: (refrescar) => clavesDe(String(env.ACCESS_EQUIPO || "").trim(), refrescar),
    });
    return carga.email.trim().toLowerCase();
  } catch (e) {
    if (e instanceof ErrorAcceso) {
      console.warn("Acceso rechazado:", e.message);
      throw new ErrorPeticion(403, "acceso", "No tiene permiso. Entre de nuevo desde la página de precios.");
    }
    throw e;
  }
}

/** El correo de la sesión tiene que ser el dueño o alguien agregado. */
function exigirPermiso(usuario, acceso, env) {
  const rol = rolDe(usuario, acceso, env.CORREO_DUENO);
  if (!rol) {
    console.warn("Sin permiso:", usuario);
    throw new ErrorPeticion(403, "sin-permiso", "Su correo todavía no tiene permiso para cambiar precios.", { usuario });
  }
  return rol;
}

function exigirMismoOrigen(request) {
  const url = new URL(request.url);
  const origen = request.headers.get("Origin");
  const sitio = request.headers.get("Sec-Fetch-Site");
  const tipo = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (origen !== url.origin || (sitio && sitio !== "same-origin") || tipo !== "application/json") {
    throw new ErrorPeticion(403, "origen", "Petición rechazada.");
  }
}

async function leerCuerpo(request) {
  const largo = Number(request.headers.get("Content-Length") || 0);
  if (!(largo > 0) || largo > MAX_CUERPO) throw new ErrorPeticion(413, "datos", "Datos vacíos o demasiado grandes.");
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) throw new ErrorPeticion(413, "datos", "Datos demasiado grandes.");
  try { return JSON.parse(texto); } catch (e) { throw new ErrorPeticion(400, "datos", "Datos inválidos."); }
}

function estadoPublico(estado, precios) {
  const vigentes = pendientesVigentes(estado.cambios, precios);
  return {
    version: estado.version,
    pendientes: Object.entries(vigentes).map(([clave, c]) => {
      const p = precios.get(clave);
      return { clave, id: p.id, pres: p.pres, n: p.n, desde: c.desde, valor: c.valor, cuando: c.cuando };
    }),
  };
}

async function atender(request, env, ctx) {
  const url = new URL(request.url);
  const ruta = url.pathname;
  const metodo = request.method;

  if (ruta === "/api/menu" && (metodo === "GET" || metodo === "HEAD")) {
    const cuerpo = await enMemoria(env, ruta, CACHE_MENU_S, async () => {
      const datos = await menuPublicado(env, url);
      return menuEnVivo(datos, (await almacen(env).leer()).cambios);
    });
    return json(200, cuerpo, { cache: `public, max-age=${CACHE_MENU_S}` });
  }

  if (ruta === "/api/precios-web" && metodo === "GET") {
    // Público (lo lee publicar.command, sin correos) y en memoria unos segundos
    const cuerpo = await enMemoria(env, ruta, CACHE_PRECIOS_WEB_S, async () => {
      const precios = indexarPrecios(await menuPublicado(env, url));
      return estadoPublico(await almacen(env).leer(), precios);
    });
    return json(200, cuerpo);
  }

  if (ruta === "/precios/api/estado" && metodo === "GET") {
    const usuario = await exigirSesion(request, env);
    const { estado, acceso } = await almacen(env).leerTodo();
    const rol = exigirPermiso(usuario, acceso, env);
    const datos = await menuPublicado(env, url);
    const vigentes = pendientesVigentes(estado.cambios, indexarPrecios(datos));
    return json(200, {
      usuario, rol, version: estado.version, menu: datos, pendientes: vigentes,
      historial: estado.historial.slice(0, 30), acceso: vistaAcceso(acceso, env.CORREO_DUENO),
    });
  }

  if (ruta === "/precios/api/precios" && metodo === "PUT") {
    exigirMismoOrigen(request);
    const usuario = await exigirSesion(request, env);
    const cuerpo = await leerCuerpo(request);
    if (!cuerpo || typeof cuerpo !== "object" || !Number.isInteger(cuerpo.version)) throw new ErrorPeticion(400, "datos", "Falta la versión.");
    const { estado: actual, acceso } = await almacen(env).leerTodo();
    exigirPermiso(usuario, acceso, env);
    const datos = await menuPublicado(env, url);
    const precios = indexarPrecios(datos);
    if (cuerpo.version !== actual.version) throw new ErrorPeticion(409, "conflicto", "Otra persona guardó precios mientras usted editaba.");
    const cambios = validarCambios(cuerpo.cambios, precios, pendientesVigentes(actual.cambios, precios));
    const r = await almacen(env).guardar(cuerpo.version, cambios, [...precios.entries()], usuario, String(env.CORREO_DUENO || ""));
    if (r.prohibido) throw new ErrorPeticion(403, "sin-permiso", "Su correo ya no tiene permiso para cambiar precios.", { usuario });
    if (r.conflicto) throw new ErrorPeticion(409, "conflicto", "Otra persona guardó precios mientras usted editaba.");
    olvidarCache(env);
    console.log(`Precios guardados por ${usuario}: ${cambios.map((c) => c.clave + "=" + c.valor).join(", ")}`);
    const vigentes = pendientesVigentes(r.estado.cambios, precios);
    return json(200, { ok: true, usuario, version: r.estado.version, pendientes: vigentes, historial: r.estado.historial.slice(0, 30) });
  }

  if (ruta === "/precios/api/acceso" && metodo === "PUT") {
    exigirMismoOrigen(request);
    const usuario = await exigirSesion(request, env);
    const cuerpo = await leerCuerpo(request);
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) throw new ErrorPeticion(400, "datos", "Datos inválidos.");
    const cambio = { accion: String(cuerpo.accion || ""), correo: typeof cuerpo.correo === "string" ? cuerpo.correo.slice(0, 300) : "" };
    // El permiso se comprueba dentro del Durable Object, junto con el cambio (no hay carreras)
    const r = await almacen(env).cambiarAcceso(cambio, usuario, String(env.CORREO_DUENO || ""));
    if (r.error) {
      if (r.error.cuerpo.error === "sin-permiso") r.error.cuerpo.usuario = usuario;
      return json(r.error.estado, r.error.cuerpo);
    }
    console.log(`Acceso: ${usuario} → ${cambio.accion} ${cambio.correo}`);
    return json(200, { ok: true, usuario, rol: rolDe(usuario, r.acceso, env.CORREO_DUENO), acceso: vistaAcceso(r.acceso, env.CORREO_DUENO) });
  }

  if (RUTAS_API.has(ruta)) throw new ErrorPeticion(405, "metodo", "Método no permitido.");
  if (ruta.startsWith("/api/") || ruta.startsWith("/precios/api/")) throw new ErrorPeticion(404, "ruta", "Ruta no disponible.");
  // Cualquier otra ruta: los archivos de la web
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await atender(request, env, ctx);
    } catch (e) {
      if (e instanceof ErrorPeticion) return json(e.estado, e.cuerpo);
      console.error("Error interno:", e && e.stack || e);
      return json(500, { error: "interno", mensaje: "Error del servidor. No se guardó nada." });
    }
  },
};
