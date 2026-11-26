/* =====================================================================
   Lógica del Worker de la web (sin dependencias de Cloudflare: se prueba en Node).

   - Lee menu-datos.js como datos (JSON.parse), nunca como código.
   - Precios cambiados en la web: se guardan como «pendientes» sobre el precio
     publicado. Un pendiente vale mientras el precio publicado siga siendo el de
     antes del cambio (desde). Cuando publicar.command lo pasa al menú QR y se
     publica, el precio publicado cambia y el pendiente se da por aplicado.
   - Verifica el JWT de Cloudflare Access (RS256, emisor, audiencia, vigencia).
   ===================================================================== */

export const PRECIO_MAX = 1000000;
export const VARIABLE = "window.MENU_RESPALDO";
const ID = /^[a-z0-9-]{1,40}$/;

export class ErrorPeticion extends Error {
  constructor(estado, codigo, mensaje, extra = {}) {
    super(mensaje);
    this.estado = estado;
    this.cuerpo = { error: codigo, mensaje, ...extra };
  }
}

const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const textoEs = (v) => (typeof v === "string" ? v : esObjeto(v) && typeof v.es === "string" ? v.es : "");
export const precioValido = (v) => Number.isInteger(v) && v >= 0 && v <= PRECIO_MAX;

/* ---------- menu-datos.js ---------- */
const PREFIJO_VALIDO = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*window\.MENU_RESPALDO\s*=\s*$/;

export function leerMenuJS(texto) {
  const i = texto.indexOf(VARIABLE);
  const igual = i < 0 ? null : /^\s*=\s*/.exec(texto.slice(i + VARIABLE.length));
  if (!igual) throw new ErrorPeticion(500, "menu", "El menú publicado no tiene el formato esperado.");
  const inicio = i + VARIABLE.length + igual[0].length;
  if (!PREFIJO_VALIDO.test(texto.slice(0, inicio))) throw new ErrorPeticion(500, "menu", "El menú publicado tiene contenido inesperado.");
  let cuerpo = texto.slice(inicio).trimEnd();
  if (cuerpo.endsWith(";")) cuerpo = cuerpo.slice(0, -1);
  let datos;
  try { datos = JSON.parse(cuerpo); } catch (e) { throw new ErrorPeticion(500, "menu", "El menú publicado no es un JSON válido."); }
  if (!esObjeto(datos) || !esObjeto(datos.categorias) || !esObjeto(datos.momentos)) {
    throw new ErrorPeticion(500, "menu", "El menú publicado no tiene categorías.");
  }
  return datos;
}

/* ---------- Precios: clave = "id", "id@presentación" o "id@presentación#n" ---------- */
export function claveDe(id, pres, n) {
  return pres ? `${id}@${pres}${n ? "#" + n : ""}` : id;
}

/** Map clave → { clave, id, pres, n, nombre, cid, categoria, valor } de todos los precios. */
export function indexarPrecios(datos) {
  const r = new Map();
  for (const [cid, c] of Object.entries(datos.categorias || {})) {
    if (!esObjeto(c) || !Array.isArray(c.platos)) continue;
    const categoria = textoEs(c.nombre) || cid;
    for (const p of c.platos) {
      if (!esObjeto(p) || typeof p.id !== "string" || !ID.test(p.id)) continue;
      const nombre = textoEs(p.n) || p.id;
      if (Array.isArray(p.pres) && p.pres.length) {
        const vistas = {};
        p.pres.forEach((par, indice) => {
          if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== "string") return;
          const n = vistas[par[0]] || 0;
          vistas[par[0]] = n + 1;
          const clave = claveDe(p.id, par[0], n);
          r.set(clave, { clave, id: p.id, pres: par[0], n, indice, nombre, cid, categoria, valor: par[1] });
        });
      } else if (typeof p.p === "number") {
        r.set(p.id, { clave: p.id, id: p.id, pres: "", n: 0, indice: -1, nombre, cid, categoria, valor: p.p });
      }
    }
  }
  return r;
}

/** Solo los pendientes que siguen valiendo: el precio publicado aún es el de antes del cambio. */
export function pendientesVigentes(cambios, precios) {
  const r = {};
  for (const [clave, c] of Object.entries(cambios || {})) {
    const p = precios.get(clave);
    if (p && esObjeto(c) && c.desde === p.valor && precioValido(c.valor) && c.valor !== p.valor) r[clave] = c;
  }
  return r;
}

/** Copia del menú publicado con los precios pendientes puestos. */
export function menuEnVivo(datos, cambios) {
  const precios = indexarPrecios(datos);
  const vigentes = pendientesVigentes(cambios, precios);
  if (!Object.keys(vigentes).length) return datos;
  const copia = JSON.parse(JSON.stringify(datos));
  for (const [clave, c] of Object.entries(vigentes)) {
    const p = precios.get(clave);
    const plato = copia.categorias[p.cid].platos.find((x) => x && x.id === p.id);
    if (!plato) continue;
    if (p.pres) plato.pres[p.indice][1] = c.valor;
    else plato.p = c.valor;
  }
  return copia;
}

/** Valida lo que manda el editor. Cada cambio dice el precio que se veía (desde) y el nuevo (valor). */
export function validarCambios(lista, precios, vigentes) {
  if (!Array.isArray(lista) || !lista.length || lista.length > 300) {
    throw new ErrorPeticion(400, "datos", "No hay cambios válidos para guardar.");
  }
  const vistos = new Set(), limpios = [], choques = [];
  for (const c of lista) {
    if (!esObjeto(c) || typeof c.clave !== "string" || c.clave.length > 100 || vistos.has(c.clave)) {
      throw new ErrorPeticion(400, "datos", "Un cambio tiene un formato inválido.");
    }
    vistos.add(c.clave);
    const p = precios.get(c.clave);
    if (!p) throw new ErrorPeticion(400, "datos", "Un producto ya no está en la carta. Recargue la página.");
    if (!precioValido(c.valor)) throw new ErrorPeticion(400, "precio", `El precio de ${p.nombre} debe ser un número entero entre 0 y ${PRECIO_MAX}.`);
    const actual = vigentes[c.clave] ? vigentes[c.clave].valor : p.valor;
    if (c.desde !== actual) choques.push(c.clave);
    limpios.push({ clave: c.clave, valor: c.valor });
  }
  if (choques.length) throw new ErrorPeticion(409, "conflicto", "Otra persona cambió algunos precios mientras usted editaba.", { claves: choques });
  return limpios;
}

/** Estado guardado en el Durable Object. */
export function estadoVacio() {
  return { version: 0, cambios: {}, historial: [] };
}
export function normalizarEstado(e) {
  if (!esObjeto(e) || !Number.isInteger(e.version) || !esObjeto(e.cambios) || !Array.isArray(e.historial)) return estadoVacio();
  return e;
}

/**
 * Aplica cambios ya validados. Devuelve el estado nuevo (no modifica el recibido).
 * - Volver al precio publicado borra el pendiente.
 * - Se descartan los pendientes que ya no valen (el precio publicado cambió).
 */
export function aplicarEnEstado(estado, cambios, precios, quien, ahora) {
  const nuevo = { version: estado.version + 1, cambios: {}, historial: estado.historial.slice(0, 199) };
  const vigentes = pendientesVigentes(estado.cambios, precios);
  for (const [clave, c] of Object.entries(vigentes)) nuevo.cambios[clave] = c;
  const lineas = [];
  for (const { clave, valor } of cambios) {
    const p = precios.get(clave);
    const antes = vigentes[clave] ? vigentes[clave].valor : p.valor;
    if (valor === p.valor) delete nuevo.cambios[clave];
    else nuevo.cambios[clave] = { desde: p.valor, valor, cuando: ahora, quien };
    lineas.push({ clave, nombre: p.pres ? `${p.nombre} (${p.pres})` : p.nombre, antes, despues: valor });
  }
  // Registro acotado: hasta 50 líneas por guardado y unos 500 KB en total (límite de almacenamiento)
  nuevo.historial.unshift({ en: ahora, quien, cambios: lineas.slice(0, 50), total: lineas.length });
  while (nuevo.historial.length > 1 && JSON.stringify(nuevo).length > 500000) nuevo.historial.pop();
  return nuevo;
}

/* ---------- Cloudflare Access: verificación del JWT ---------- */
const deB64url = (s) => {
  let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};
const jsonDe = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

export class ErrorAcceso extends Error {}

/**
 * Verifica el token que Cloudflare Access agrega a cada petición (Cf-Access-Jwt-Assertion).
 * obtenerClaves(refrescar) devuelve las claves públicas (JWK) del equipo.
 */
export async function verificarAcceso(token, { equipo, aud, obtenerClaves, ahora = Date.now() / 1000 }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(equipo || "") || !/^[0-9a-f]{64}$/.test(aud || "")) {
    throw new ErrorAcceso("El acceso no está configurado (equipo o AUD).");
  }
  if (typeof token !== "string" || !token || token.length > 8192) throw new ErrorAcceso("Falta el token de acceso.");
  const partes = token.split(".");
  if (partes.length !== 3) throw new ErrorAcceso("Token de acceso mal formado.");
  let cabecera, carga, firma;
  try {
    cabecera = jsonDe(deB64url(partes[0])); carga = jsonDe(deB64url(partes[1])); firma = deB64url(partes[2]);
  } catch (e) {
    throw new ErrorAcceso("Token de acceso mal formado.");
  }
  if (!esObjeto(cabecera) || !esObjeto(carga)) throw new ErrorAcceso("Token de acceso mal formado.");
  if (cabecera.alg !== "RS256" || typeof cabecera.kid !== "string") throw new ErrorAcceso("Algoritmo no admitido.");
  let jwk = (await obtenerClaves(false)).find((k) => k && k.kid === cabecera.kid && k.kty === "RSA");
  if (!jwk) jwk = (await obtenerClaves(true)).find((k) => k && k.kid === cabecera.kid && k.kty === "RSA");
  if (!jwk) throw new ErrorAcceso("Clave de firma desconocida.");
  let firmaOk = false;
  try {
    const clave = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    firmaOk = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", clave, firma, new TextEncoder().encode(partes[0] + "." + partes[1]));
  } catch (e) {
    throw new ErrorAcceso("No se pudo comprobar la firma.");
  }
  if (!firmaOk) throw new ErrorAcceso("Firma inválida.");
  // Una firma válida no basta: también emisor, audiencia y vigencia (documentación de Access).
  if (carga.iss !== `https://${equipo}.cloudflareaccess.com`) throw new ErrorAcceso("Emisor inesperado.");
  const auds = Array.isArray(carga.aud) ? carga.aud : [carga.aud];
  if (!auds.includes(aud)) throw new ErrorAcceso("El token es de otra aplicación.");
  if (typeof carga.exp !== "number" || carga.exp < ahora - 30) throw new ErrorAcceso("La sesión venció.");
  if (typeof carga.nbf === "number" && carga.nbf > ahora + 60) throw new ErrorAcceso("Token todavía no válido.");
  if (typeof carga.email !== "string" || !carga.email.includes("@")) throw new ErrorAcceso("El token no trae el correo.");
  return carga;
}

/** Lista de correos permitidos ("a@x.com, b@y.com"). Vacía = nadie (falla cerrado). */
export function correoPermitido(email, lista) {
  const permitidos = String(lista || "").split(/[,\s;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return permitidos.includes(String(email || "").trim().toLowerCase());
}
