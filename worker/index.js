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

   Seguridad:
   - /precios/* está detrás de Cloudflare Access (código al correo). Además, aquí
     se verifica el JWT de Access (firma RS256, emisor, audiencia, vigencia) y que el
     correo esté en CORREOS_ADMIN: si Access se configura mal o alguien llega por otra
     dirección, igual se rechaza (falla cerrado).
   - Escrituras: solo JSON, mismo origen (Origin y Sec-Fetch-Site) → sin CSRF.
   - Solo cambian números de precio de productos que existen, enteros de 0 a 1 000 000.
   - Concurrencia: versión del Durable Object; si otra persona guardó antes, 409.
   - Registro: quién, cuándo y qué cambió (últimos 200 guardados).
   Variables (en Cloudflare, como «secretos»): ACCESS_EQUIPO, ACCESS_AUD, CORREOS_ADMIN.
   ===================================================================== */
import { DurableObject } from "cloudflare:workers";
import {
  ErrorPeticion, ErrorAcceso, leerMenuJS, indexarPrecios, pendientesVigentes, menuEnVivo,
  validarCambios, normalizarEstado, aplicarEnEstado, verificarAcceso, correoPermitido,
} from "./logica.js";

const MAX_CUERPO = 64 * 1024;
const RUTAS_API = new Set(["/api/menu", "/api/precios-web", "/precios/api/estado", "/precios/api/precios"]);
const CACHE_MENU_S = 60;

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

  /** Atómico: dentro de un Durable Object no se intercalan dos guardados. */
  async guardar(versionBase, cambios, precios, quien) {
    const estado = normalizarEstado(await this.ctx.storage.get("estado"));
    if (versionBase !== estado.version) return { conflicto: true, estado };
    const nuevo = aplicarEnEstado(estado, cambios, new Map(precios), quien, Date.now());
    await this.ctx.storage.put("estado", nuevo);
    return { conflicto: false, estado: nuevo };
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

async function exigirAdministrador(request, env) {
  try {
    const carga = await verificarAcceso(request.headers.get("Cf-Access-Jwt-Assertion"), {
      equipo: String(env.ACCESS_EQUIPO || "").trim(), aud: String(env.ACCESS_AUD || "").trim(),
      obtenerClaves: (refrescar) => clavesDe(String(env.ACCESS_EQUIPO || "").trim(), refrescar),
    });
    if (!correoPermitido(carga.email, env.CORREOS_ADMIN)) throw new ErrorAcceso("Correo no autorizado.");
    return carga.email.toLowerCase();
  } catch (e) {
    if (e instanceof ErrorAcceso) {
      console.warn("Acceso rechazado:", e.message);
      throw new ErrorPeticion(403, "acceso", "No tiene permiso. Entre de nuevo desde la página de precios.");
    }
    throw e;
  }
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
    const cache = caches.default;
    const clave = new Request(url.origin + "/api/menu");
    const guardada = await cache.match(clave);
    if (guardada) return guardada;
    const datos = await menuPublicado(env, url);
    const estado = await almacen(env).leer();
    const r = json(200, menuEnVivo(datos, estado.cambios), { cache: `public, max-age=${CACHE_MENU_S}` });
    ctx.waitUntil(cache.put(clave, r.clone()));
    return r;
  }

  if (ruta === "/api/precios-web" && metodo === "GET") {
    // Público y en caché 30 s: lo lee publicar.command; nadie puede gastar el Durable Object pidiéndolo mil veces
    const cache = caches.default;
    const clave = new Request(url.origin + "/api/precios-web");
    const guardada = await cache.match(clave);
    if (guardada) return guardada;
    const precios = indexarPrecios(await menuPublicado(env, url));
    const r = json(200, estadoPublico(await almacen(env).leer(), precios), { cache: "public, max-age=30" });
    ctx.waitUntil(cache.put(clave, r.clone()));
    return r;
  }

  if (ruta === "/precios/api/estado" && metodo === "GET") {
    const usuario = await exigirAdministrador(request, env);
    const datos = await menuPublicado(env, url);
    const estado = await almacen(env).leer();
    const vigentes = pendientesVigentes(estado.cambios, indexarPrecios(datos));
    return json(200, { usuario, version: estado.version, menu: datos, pendientes: vigentes, historial: estado.historial.slice(0, 30) });
  }

  if (ruta === "/precios/api/precios" && metodo === "PUT") {
    exigirMismoOrigen(request);
    const usuario = await exigirAdministrador(request, env);
    const cuerpo = await leerCuerpo(request);
    if (!cuerpo || typeof cuerpo !== "object" || !Number.isInteger(cuerpo.version)) throw new ErrorPeticion(400, "datos", "Falta la versión.");
    const datos = await menuPublicado(env, url);
    const precios = indexarPrecios(datos);
    const actual = await almacen(env).leer();
    if (cuerpo.version !== actual.version) throw new ErrorPeticion(409, "conflicto", "Otra persona guardó precios mientras usted editaba.");
    const cambios = validarCambios(cuerpo.cambios, precios, pendientesVigentes(actual.cambios, precios));
    const r = await almacen(env).guardar(cuerpo.version, cambios, [...precios.entries()], usuario);
    if (r.conflicto) throw new ErrorPeticion(409, "conflicto", "Otra persona guardó precios mientras usted editaba.");
    ctx.waitUntil(Promise.all(["/api/menu", "/api/precios-web"].map((r) => caches.default.delete(new Request(url.origin + r)))));
    console.log(`Precios guardados por ${usuario}: ${cambios.map((c) => c.clave + "=" + c.valor).join(", ")}`);
    const vigentes = pendientesVigentes(r.estado.cambios, precios);
    return json(200, { ok: true, usuario, version: r.estado.version, pendientes: vigentes, historial: r.estado.historial.slice(0, 30) });
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
