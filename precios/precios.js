/* =====================================================================
   EDITOR DE PRECIOS DE LA WEB · Hotel Frontera · Restaurante Las Margaritas

   Cambia solo los precios de menu-datos.js en GitHub. GitHub Pages publica
   el cambio en la web en unos minutos.

   Seguridad (OWASP Top 10:2025 y hojas de referencia de OWASP):
   - Control de acceso (A01): GitHub decide quién puede escribir. Hace falta
     un token fino (github_pat_) con permiso «Contents: Read and write» sobre
     este repositorio. Esta página no tiene claves propias ni servidor.
   - Configuración (A02): CSP estricta en index.html (solo archivos propios y
     api.github.com), Trusted Types, sin marcos, sin formularios hacia afuera,
     sin referer. La página se niega a funcionar dentro de un marco o abierta
     por otra ventana.
   - Criptografía (A04): si se pide recordar el token, se guarda cifrado con
     AES-GCM de 256 bits; la clave sale de la frase con PBKDF2-HMAC-SHA256 y
     600 000 iteraciones (lo que recomienda OWASP), con sal aleatoria.
   - Inyección (A05): el menú se lee con JSON.parse, nunca con eval, y la
     página se arma con textContent y createElement, nunca con innerHTML.
   - Autenticación (A07): frase de 12 caracteres o más, espera creciente tras
     cada error y borrado del token guardado después de 10 errores. Se bloquea
     sola por inactividad o al quedar en segundo plano.
   - Integridad (A08): se comprueba el SHA del archivo que entrega GitHub;
     antes de publicar se verifica que solo cambian números de precio; la
     publicación usa el SHA del archivo leído, así no pisa cambios ajenos.
   - Registro (A09): cada publicación es un commit con la lista de cambios.
   - Errores (A10): ante cualquier respuesta inesperada no se publica nada.
   ===================================================================== */
(() => {
  "use strict";

  /* ---------- 0. Nunca dentro de un marco (clickjacking) ---------- */
  if (window.top !== window.self) {
    try { window.top.location = window.self.location.href; } catch (e) { /* el marco lo impide: la página sigue oculta */ }
    return;
  }

  /* ---------- Configuración fija: esta página solo escribe este archivo ---------- */
  const REPO = Object.freeze({ dueno: "Agustin627", nombre: "hofrosa-web", rama: "main", archivo: "menu-datos.js" });
  const API = "https://api.github.com";
  const RUTA_REPO = `/repos/${REPO.dueno}/${REPO.nombre}`;
  const WEB_REPO = `https://github.com/${REPO.dueno}/${REPO.nombre}`;
  const VARIABLE = "window.MENU_RESPALDO";
  const PRECIO_MAX = 1000000;            // el mismo tope que acepta el servidor de pedidos
  const ITERACIONES = 600000;            // OWASP: PBKDF2-HMAC-SHA256, 600 000 iteraciones
  const FRASE_MIN = 12;
  const INTENTOS_MAX = 10;               // frases incorrectas antes de borrar el token guardado
  const INACTIVIDAD_MS = 15 * 60 * 1000;
  const SEGUNDO_PLANO_MS = 5 * 60 * 1000;
  const CLAVE_ALMACEN = "hofrosa.precios.token.v1";
  const PRESENTACIONES = { botella: "Botella", media: "Media botella", trago: "Trago" };
  const URL_CREAR_TOKEN = "https://github.com/settings/personal-access-tokens/new?" + new URLSearchParams({
    name: "Precios web Hotel Frontera",
    description: "Cambiar precios de la carta desde la web (solo el repositorio hofrosa-web)",
    target_name: REPO.dueno, expires_in: "90", contents: "write",
  });

  const texto = new TextEncoder();
  const deTexto = new TextDecoder("utf-8", { fatal: true });
  const CONTEXTO_CIFRADO = texto.encode(`hofrosa-precios/v1/${REPO.dueno}/${REPO.nombre}`);
  const $ = (s) => document.querySelector(s);

  /* ---------- Estado (el token vive solo en memoria mientras está desbloqueado) ---------- */
  const S = {
    token: null,
    usuario: "",
    base: null,          // { texto, prefijo, datos, sha } tal como está en GitHub
    items: new Map(),    // clave -> { clave, cid, nombreCat, pid, nombre, pres, indice, original }
    editados: new Map(), // clave -> { desde, hasta }
    invalidos: new Set(),
    filas: new Map(),    // clave -> { input, antes, caja }
    ocupado: false,
    reloj: null,
    ocultaDesde: 0,
  };

  class ErrorUsuario extends Error {}
  class ErrorGitHub extends Error {
    constructor(estado, datos, cabeceras) {
      super(`GitHub ${estado}`);
      this.estado = estado;
      this.datos = datos || {};
      const restantes = cabeceras ? cabeceras.get("x-ratelimit-remaining") : null;
      this.limite = (estado === 403 || estado === 429)
        && (restantes === "0" || /rate limit/i.test(String(this.datos.message || "")));
    }
  }

  /* ---------- Utilidades del DOM (sin HTML como texto) ---------- */
  function el(etiqueta, atributos, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(atributos || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "texto") nodo.textContent = String(v);
      else if (k === "clase") nodo.className = v;
      else nodo.setAttribute(k, v === true ? "" : String(v));
    }
    for (const h of hijos.flat()) {
      if (h === null || h === undefined || h === false) continue;
      nodo.append(h instanceof Node ? h : String(h));
    }
    return nodo;
  }
  const numero = (n) => Number(n).toLocaleString("es-NI", { maximumFractionDigits: 2 });
  const sinAcentos = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const textoEs = (v) => (typeof v === "string" ? v : v && typeof v === "object" && typeof v.es === "string" ? v.es : "");

  let relojEstado = null;
  function estado(mensaje) {
    clearTimeout(relojEstado);
    $("#estado").textContent = mensaje || "";
    if (mensaje) relojEstado = setTimeout(() => { $("#estado").textContent = ""; }, 5000);
  }
  function aviso(mensaje, tipo = "mal") {
    const caja = $("#aviso-general");
    caja.textContent = mensaje || "";
    caja.classList.toggle("ok", tipo === "ok");
    caja.hidden = !mensaje;
  }
  function avisoConEnlace(mensaje, enlace, textoEnlace) {
    aviso(mensaje, "ok");
    if (enlace) $("#aviso-general").append(" ", el("a", { href: enlace, target: "_blank", rel: "noopener noreferrer", texto: textoEnlace }));
  }

  /* ---------- Base64 y bytes ---------- */
  function aBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deBase64(b64) {
    const s = atob(String(b64).replace(/\s+/g, ""));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  async function shaBlob(bytes) {
    // Git identifica cada archivo por SHA-1("blob <tamaño>\0" + contenido)
    const cabecera = texto.encode(`blob ${bytes.length}\0`);
    const todo = new Uint8Array(cabecera.length + bytes.length);
    todo.set(cabecera); todo.set(bytes, cabecera.length);
    return hex(await crypto.subtle.digest("SHA-1", todo));
  }

  /* ---------- GitHub ---------- */
  async function gh(ruta, { metodo = "GET", cuerpo } = {}) {
    if (!S.token) throw new ErrorUsuario("La sesión está bloqueada.");
    const ctrl = new AbortController();
    const espera = setTimeout(() => ctrl.abort(), 25000);
    let r;
    try {
      r = await fetch(API + ruta, {
        method: metodo,
        headers: Object.assign({ Accept: "application/vnd.github+json", Authorization: "Bearer " + S.token },
          cuerpo ? { "Content-Type": "application/json" } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: ctrl.signal,
      });
    } catch (e) {
      throw new ErrorUsuario("No hay conexión con GitHub. Revise internet e intente de nuevo.");
    } finally {
      clearTimeout(espera);
    }
    let datos = null;
    try { datos = await r.json(); } catch (e) { datos = null; }
    if (!r.ok) throw new ErrorGitHub(r.status, datos, r.headers);
    return datos;
  }
  function mensajeError(e) {
    if (e instanceof ErrorUsuario) return e.message;
    if (e instanceof ErrorGitHub) {
      if (e.limite) return "GitHub pidió esperar por demasiadas solicitudes. Intente de nuevo en unos minutos.";
      if (e.estado === 401) return "GitHub no aceptó el token: venció, lo borraron o está mal copiado. Cree otro y vuelva a entrar.";
      if (e.estado === 403) return "El token no tiene permiso para cambiar la web. Al crearlo, en «Permissions → Contents» elija «Read and write», y en «Repository access», hofrosa-web.";
      if (e.estado === 404) return "El token no tiene acceso al repositorio hofrosa-web. Al crearlo, elija «Only select repositories» y marque hofrosa-web.";
      if (e.estado >= 500) return "GitHub tiene un problema en este momento. Intente de nuevo en unos minutos.";
      return `GitHub respondió con un error (${e.estado}). No se cambió nada.`;
    }
    console.error(e);
    return "Ocurrió un error inesperado. No se cambió nada.";
  }

  /* ---------- Lectura y escritura de menu-datos.js (solo datos, nunca código) ---------- */
  const PREFIJO_VALIDO = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*window\.MENU_RESPALDO\s*=\s*$/;
  function leerMenu(contenido) {
    const i = contenido.indexOf(VARIABLE);
    const igual = i < 0 ? null : /^\s*=\s*/.exec(contenido.slice(i + VARIABLE.length));
    if (!igual) throw new ErrorUsuario("El archivo del menú no tiene el formato esperado. No se puede editar desde aquí.");
    const inicio = i + VARIABLE.length + igual[0].length;
    const prefijo = contenido.slice(0, inicio);
    // Antes del menú solo puede haber comentarios: si hubiera código, no se toca el archivo.
    if (!PREFIJO_VALIDO.test(prefijo)) throw new ErrorUsuario("El archivo del menú tiene contenido inesperado al principio. Revíselo antes de editar precios.");
    let cuerpo = contenido.slice(inicio).trimEnd();
    if (cuerpo.endsWith(";")) cuerpo = cuerpo.slice(0, -1);
    let datos;
    try { datos = JSON.parse(cuerpo); } catch (e) {
      throw new ErrorUsuario("El menú publicado no es un JSON válido. No se puede editar desde aquí.");
    }
    validarEstructura(datos);
    return { prefijo, datos };
  }
  function escribirMenu(prefijo, datos) {
    // Mismo formato que editor/editor_menu.py (json.dumps con indent=1): los cambios en git son mínimos.
    return prefijo + JSON.stringify(datos, null, 1) + ";\n";
  }
  const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const esPrecio = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= PRECIO_MAX;
  function validarEstructura(d) {
    const mal = (m) => { throw new ErrorUsuario("El menú publicado tiene un formato inesperado (" + m + "). No se puede editar desde aquí."); };
    if (!esObjeto(d) || !esObjeto(d.categorias) || !esObjeto(d.momentos)) mal("categorías o momentos");
    const vistos = new Set();
    for (const [cid, c] of Object.entries(d.categorias)) {
      if (!/^[a-z0-9-]{1,40}$/.test(cid) || !esObjeto(c) || !Array.isArray(c.platos)) mal("categoría " + cid);
      for (const p of c.platos) {
        if (!esObjeto(p) || typeof p.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(p.id)) mal("plato en " + cid);
        if (vistos.has(p.id)) mal("plato repetido " + p.id);
        vistos.add(p.id);
        if (!textoEs(p.n).trim()) mal("nombre de " + p.id);
        if (p.pres !== undefined) {
          if (!Array.isArray(p.pres) || !p.pres.length || !p.pres.every((x) => Array.isArray(x) && x.length === 2
            && typeof x[0] === "string" && esPrecio(x[1]))) mal("presentaciones de " + p.id);
        } else if (!esPrecio(p.p)) mal("precio de " + p.id);
      }
    }
  }
  function indexar(datos) {
    const items = new Map();
    for (const [cid, c] of Object.entries(datos.categorias)) {
      const nombreCat = textoEs(c.nombre) || cid;
      for (const p of c.platos) {
        const nombre = textoEs(p.n);
        if (Array.isArray(p.pres) && p.pres.length) {
          p.pres.forEach(([pres, valor], indice) => {
            const clave = `${p.id}#${indice}`;
            items.set(clave, { clave, cid, nombreCat, pid: p.id, nombre, pres, indice, original: valor });
          });
        } else {
          items.set(p.id, { clave: p.id, cid, nombreCat, pid: p.id, nombre, pres: null, indice: -1, original: p.p });
        }
      }
    }
    return items;
  }
  const nombrePres = (pres) => PRESENTACIONES[pres] || pres;
  const etiquetaItem = (item) => item.pres === null ? item.nombre : `${item.nombre} (${nombrePres(item.pres).toLowerCase()})`;

  // Copia del menú con todos los precios en cero: sirve para comprobar que nada más cambió.
  function sinPrecios(datos) {
    const copia = JSON.parse(JSON.stringify(datos));
    for (const c of Object.values(copia.categorias)) {
      for (const p of c.platos) {
        if (Array.isArray(p.pres)) p.pres.forEach((par) => { par[1] = 0; });
        else p.p = 0;
      }
    }
    return JSON.stringify(copia);
  }
  function aplicarCambios(datos, cambios) {
    const copia = JSON.parse(JSON.stringify(datos));
    const platos = new Map();
    for (const c of Object.values(copia.categorias)) for (const p of c.platos) platos.set(p.id, p);
    for (const [clave, { hasta }] of cambios) {
      const item = S.items.get(clave);
      const p = item && platos.get(item.pid);
      if (!p) throw new ErrorUsuario("Un plato ya no está en la carta. Recargue la página.");
      if (item.pres === null) p.p = hasta;
      else p.pres[item.indice][1] = hasta;
    }
    return copia;
  }

  /* ---------- Token guardado y cifrado en este dispositivo ---------- */
  function almacen() {
    try { const k = "hofrosa.prueba"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; }
  }
  function leerGuardado() {
    const ls = almacen();
    if (!ls) return null;
    let g;
    try { g = JSON.parse(ls.getItem(CLAVE_ALMACEN) || "null"); } catch (e) { g = null; }
    // Lo guardado se trata como no confiable: se valida antes de usarlo.
    const b64 = (v) => typeof v === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(v) && v.length <= 2048;
    if (!esObjeto(g) || g.v !== 1 || !Number.isInteger(g.it) || g.it < 100000 || g.it > 5000000
      || !b64(g.sal) || !b64(g.iv) || !b64(g.dato)) {
      if (g !== null) ls.removeItem(CLAVE_ALMACEN);
      return null;
    }
    g.fallos = Number.isInteger(g.fallos) && g.fallos >= 0 ? g.fallos : 0;
    g.hasta = Number.isFinite(g.hasta) ? g.hasta : 0;
    return g;
  }
  function escribirGuardado(g) { const ls = almacen(); if (ls) ls.setItem(CLAVE_ALMACEN, JSON.stringify(g)); }
  function olvidarGuardado() { const ls = almacen(); if (ls) ls.removeItem(CLAVE_ALMACEN); }
  async function derivarClave(frase, sal, iteraciones) {
    const material = await crypto.subtle.importKey("raw", texto.encode(frase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function guardarToken(token, frase) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const clave = await derivarClave(frase, sal, ITERACIONES);
    const dato = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: CONTEXTO_CIFRADO }, clave, texto.encode(token)));
    escribirGuardado({ v: 1, kdf: "PBKDF2-SHA256", it: ITERACIONES, sal: aBase64(sal), iv: aBase64(iv), dato: aBase64(dato), fallos: 0, hasta: 0 });
  }
  async function abrirToken(g, frase) {
    const clave = await derivarClave(frase, deBase64(g.sal), g.it);
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(g.iv), additionalData: CONTEXTO_CIFRADO }, clave, deBase64(g.dato));
    return deTexto.decode(new Uint8Array(plano));
  }

  /* ---------- Reglas del token y de la frase ---------- */
  function problemaToken(token) {
    if (!token) return "Pegue su token de GitHub.";
    if (/^ghp_/.test(token)) return "Ese es un token clásico (ghp_): abre todos sus repositorios. Por seguridad, cree un token fino (empieza con github_pat_) solo para hofrosa-web.";
    if (/^gh[ousr]_/.test(token)) return "Ese no es un token personal. Cree un token fino (empieza con github_pat_).";
    if (!/^github_pat_[A-Za-z0-9_]{30,240}$/.test(token)) return "El token no parece completo. Cópielo de nuevo: empieza con github_pat_ y no tiene espacios.";
    return "";
  }
  const PALABRAS_DEL_LUGAR = ["hotel", "frontera", "margaritas", "margarita", "las", "hofrosa", "ocotal", "precios", "precio", "nicaragua", "restaurante", "menu", "carta", "github", "contrasena", "clave", "password"];
  function problemaFrase(frase, repetida, token) {
    const f = frase.normalize("NFC");
    if ([...f].length < FRASE_MIN) return `La frase debe tener al menos ${FRASE_MIN} caracteres.`;
    if (f !== repetida.normalize("NFC")) return "Las dos frases no coinciden.";
    if (token && f.includes(token.slice(0, 20))) return "La frase no puede ser el token.";
    if (new Set(f.toLowerCase()).size < 5) return "La frase repite demasiado los mismos caracteres.";
    // Sin las palabras del hotel y sin números, debe quedar algo propio (OWASP: palabras del contexto)
    let resto = sinAcentos(f).replace(/[^a-zñ]+/g, " ");
    for (const p of PALABRAS_DEL_LUGAR) resto = resto.replace(new RegExp(`\\b${p}\\b`, "g"), " ");
    if (resto.replace(/\s+/g, "").length < 8) return "La frase se adivina fácil (nombre del hotel, números…). Agregue palabras propias.";
    return "";
  }
  function medirFrase(frase) {
    const n = [...frase].length;
    const palabras = frase.trim().split(/\s+/).filter((w) => w.length >= 3).length;
    if (!n) return "";
    if (n < FRASE_MIN) return `Muy corta (${n} de ${FRASE_MIN} caracteres como mínimo).`;
    if (n >= 20 || palabras >= 4) return "Fuerte.";
    return "Aceptable. Más larga es más segura.";
  }

  /* ---------- Pasos de la pantalla ---------- */
  function mostrarPaso(paso) {
    $("#paso-conectar").hidden = paso !== "conectar";
    $("#paso-desbloquear").hidden = paso !== "desbloquear";
    $("#paso-editar").hidden = paso !== "editar";
    $("#pie-acciones").hidden = paso !== "editar";
    $("#sesion").hidden = paso !== "editar";
    if (paso === "conectar") $("#campo-token").focus();
    if (paso === "desbloquear") $("#campo-frase").focus();
  }
  function ocupar(si, mensaje) {
    S.ocupado = si;
    $("#principal").setAttribute("aria-busy", si ? "true" : "false");
    $("#boton-conectar").disabled = si;
    $("#boton-desbloquear").disabled = si;
    $("#boton-olvidar").disabled = si;
    actualizarBotonPublicar();
    actualizarResumen();
    if (mensaje) estado(mensaje);
  }
  function cerrarDialogo() {
    const d = $("#dialogo-revisar");
    if (!d.open) return;
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
  }

  function bloquear(motivo) {
    S.token = null;
    S.usuario = "";
    clearTimeout(S.reloj);
    for (const id of ["#campo-token", "#campo-frase", "#campo-frase-nueva", "#campo-frase-repetir"]) $(id).value = "";
    cerrarDialogo();
    mostrarPaso(leerGuardado() ? "desbloquear" : "conectar");
    if (motivo) aviso(motivo + (S.editados.size ? " Sus cambios sin publicar siguen aquí: al volver a entrar los verá." : ""));
  }
  function reiniciarInactividad() {
    clearTimeout(S.reloj);
    if (S.token) S.reloj = setTimeout(() => bloquear("Se bloqueó por 15 minutos sin uso."), INACTIVIDAD_MS);
  }
  ["pointerdown", "keydown", "input"].forEach((ev) => document.addEventListener(ev, reiniciarInactividad, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { S.ocultaDesde = Date.now(); return; }
    if (S.token && S.ocultaDesde && Date.now() - S.ocultaDesde > SEGUNDO_PLANO_MS) bloquear("Se bloqueó porque la página quedó en segundo plano.");
    S.ocultaDesde = 0;
  });
  window.addEventListener("beforeunload", (e) => {
    if (S.editados.size) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Entrar con un token nuevo ---------- */
  async function entrar(evento) {
    evento.preventDefault();
    if (S.ocupado) return;
    const error = $("#error-conectar");
    error.textContent = "";
    aviso("");
    const token = $("#campo-token").value.trim();
    const recordar = $("#casilla-recordar").checked;
    const frase = $("#campo-frase-nueva").value;
    let problema = problemaToken(token);
    if (!problema && recordar) problema = problemaFrase(frase, $("#campo-frase-repetir").value, token);
    if (problema) { error.textContent = problema; return; }
    ocupar(true, "Comprobando el token con GitHub…");
    try {
      S.token = token;
      try {
        const yo = await gh("/user");
        S.usuario = yo && typeof yo.login === "string" ? yo.login : "";
      } catch (e) {
        if (!(e instanceof ErrorGitHub) || e.estado === 401) throw e;   // otro error aquí no impide seguir
      }
      // Prueba de escritura sin efectos visibles: crea un objeto suelto en el repositorio
      // (no cambia ningún archivo ni la web). Confirma que el token sirve para publicar.
      await gh(`${RUTA_REPO}/git/blobs`, { metodo: "POST", cuerpo: { content: "Prueba de permiso del editor de precios", encoding: "utf-8" } });
      if (recordar) await guardarToken(token, frase);
      $("#campo-token").value = "";
      $("#campo-frase-nueva").value = "";
      $("#campo-frase-repetir").value = "";
      await abrirEditor();
    } catch (e) {
      S.token = null;
      error.textContent = mensajeError(e);
    } finally {
      ocupar(false);
    }
  }

  /* ---------- Desbloquear el token guardado ---------- */
  async function desbloquear(evento) {
    evento.preventDefault();
    if (S.ocupado) return;
    const error = $("#error-desbloquear");
    error.textContent = "";
    aviso("");
    const g = leerGuardado();
    if (!g) { bloquear(); return; }
    const espera = Math.ceil((g.hasta - Date.now()) / 1000);
    if (espera > 0) { error.textContent = `Espere ${espera} segundos antes de intentar de nuevo.`; return; }
    const frase = $("#campo-frase").value;
    if (!frase) { error.textContent = "Escriba su frase."; return; }
    ocupar(true, "Desbloqueando…");
    // El intento se anota ANTES de probar la frase: recargar la página a mitad no lo borra.
    // Si la frase es correcta, el contador vuelve a cero.
    g.fallos += 1;
    const segundos = Math.min(2 ** (g.fallos - 1), 60);
    g.hasta = Date.now() + segundos * 1000;
    escribirGuardado(g);
    let token;
    try {
      token = await abrirToken(g, frase);
    } catch (e) {
      $("#campo-frase").value = "";
      if (g.fallos >= INTENTOS_MAX) {
        olvidarGuardado();
        ocupar(false);
        bloquear("Hubo demasiadas frases incorrectas: por seguridad se borró el token de este dispositivo. Vuelva a entrar con su token de GitHub.");
        return;
      }
      error.textContent = `Frase incorrecta. Quedan ${INTENTOS_MAX - g.fallos} intentos; espere ${segundos} s.`;
      ocupar(false);
      return;
    }
    g.fallos = 0;
    g.hasta = 0;
    escribirGuardado(g);
    $("#campo-frase").value = "";
    try {
      if (problemaToken(token)) throw new ErrorUsuario("El token guardado no es válido. Olvide este dispositivo y entre de nuevo.");
      S.token = token;
      await abrirEditor();
    } catch (e) {
      S.token = null;
      error.textContent = mensajeError(e);
      if (e instanceof ErrorGitHub && e.estado === 401) error.textContent += " Use «Olvidar este dispositivo» y entre con el token nuevo.";
    } finally {
      ocupar(false);
    }
  }

  /* ---------- Cargar el menú desde GitHub ---------- */
  async function cargarMenu() {
    const r = await gh(`${RUTA_REPO}/contents/${encodeURIComponent(REPO.archivo)}?ref=${encodeURIComponent(REPO.rama)}`);
    if (!esObjeto(r) || r.type !== "file" || r.encoding !== "base64" || typeof r.content !== "string"
      || typeof r.sha !== "string" || !/^[0-9a-f]{40}$/.test(r.sha)) {
      throw new ErrorUsuario("GitHub devolvió el menú en un formato inesperado. No se cambió nada.");
    }
    const bytes = deBase64(r.content);
    if (await shaBlob(bytes) !== r.sha) throw new ErrorUsuario("El menú llegó incompleto o alterado. Recargue la página.");
    let contenido;
    try { contenido = deTexto.decode(bytes); } catch (e) { throw new ErrorUsuario("El menú no está en UTF-8. No se puede editar desde aquí."); }
    const { prefijo, datos } = leerMenu(contenido);
    return { texto: contenido, prefijo, datos, sha: r.sha };
  }

  // Al recargar (otra persona publicó, o se volvió a entrar) se conservan los cambios
  // del usuario solo si el precio de partida sigue igual; si no, se avisa.
  function reconstruir(base) {
    const anteriores = new Map(S.editados);
    S.base = base;
    S.items = indexar(base.datos);
    S.editados.clear();
    S.invalidos.clear();
    const choques = [];
    for (const [clave, cambio] of anteriores) {
      const item = S.items.get(clave);
      // La presentación debe ser la misma (si cambiaron el orden de botella/media/trago, no se adivina)
      if (!item || item.pres !== cambio.pres) { choques.push(`${cambio.etiqueta}: ya no está en la carta como antes.`); continue; }
      if (item.original === cambio.desde) S.editados.set(clave, { desde: item.original, hasta: cambio.hasta, etiqueta: etiquetaItem(item), pres: item.pres });
      else if (item.original !== cambio.hasta) choques.push(`${etiquetaItem(item)}: otra persona lo cambió a ${numero(item.original)} mientras usted editaba. Su cambio (${numero(cambio.hasta)}) no se aplicó.`);
    }
    return choques;
  }

  async function abrirEditor() {
    const base = await cargarMenu();
    const choques = reconstruir(base);
    pintarLista();
    mostrarPaso("editar");
    $("#sesion-estado").textContent = S.usuario ? `Conectado como ${S.usuario}` : "Conectado";
    if (choques.length) aviso("Algunos cambios no se conservaron:\n" + choques.join("\n"));
    reiniciarInactividad();
    estado("Menú cargado.");
    cargarHistorial();
  }

  /* ---------- Lista de precios ---------- */
  function pintarLista() {
    const lista = $("#lista-precios");
    lista.replaceChildren();
    S.filas.clear();
    const selector = $("#filtro-categoria");
    const elegida = selector.value;
    selector.replaceChildren(el("option", { value: "", texto: "Todas" }));
    const porCategoria = new Map();
    for (const item of S.items.values()) {
      if (!porCategoria.has(item.cid)) porCategoria.set(item.cid, { nombre: item.nombreCat, platos: new Map() });
      const cat = porCategoria.get(item.cid);
      if (!cat.platos.has(item.pid)) cat.platos.set(item.pid, []);
      cat.platos.get(item.pid).push(item);
    }
    for (const [cid, cat] of porCategoria) {
      selector.append(el("option", { value: cid, texto: cat.nombre }));
      const seccion = el("section", { clase: "categoria", "data-cid": cid, "aria-label": cat.nombre }, el("h3", { texto: cat.nombre }));
      for (const [pid, items] of cat.platos) {
        const nombre = items[0].nombre;
        const precios = el("div", { clase: "precios-plato" });
        const fila = el("div", { clase: "plato", "data-pid": pid, "data-buscar": sinAcentos(nombre + " " + cat.nombre) },
          el("div", {}, el("div", { clase: "plato-nombre", texto: nombre })), precios);
        for (const item of items) {
          const id = `precio-${pid}-${item.indice < 0 ? "u" : item.indice}`;
          const editado = S.editados.get(item.clave);
          const input = el("input", {
            id, type: "text", inputmode: "numeric", autocomplete: "off", maxlength: "9", spellcheck: "false",
            value: String(editado ? editado.hasta : item.original), "aria-describedby": id + "-antes",
          });
          const antes = el("span", { clase: "antes", id: id + "-antes" });
          const caja = el("div", { clase: "precio" },
            el("label", { for: id, texto: item.pres === null ? "Precio" : nombrePres(item.pres) }), input);
          precios.append(caja, antes);
          S.filas.set(item.clave, { input, antes, caja, fila });
          input.addEventListener("input", () => alCambiar(item));
          input.addEventListener("blur", () => normalizarCampo(item));
          marcarFila(item);
        }
        seccion.append(fila);
      }
      lista.append(seccion);
    }
    if ([...selector.options].some((o) => o.value === elegida)) selector.value = elegida;
    $("#enlace-historial").href = `${WEB_REPO}/commits/${REPO.rama}/${REPO.archivo}`;
    filtrar();
    actualizarResumen();
  }

  function leerPrecio(valor) {
    let v = String(valor).trim().replace(/^C\$\s*/i, "");
    if (/^\d{1,3}([.,\s]\d{3})+$/.test(v)) v = v.replace(/[.,\s]/g, "");   // 2,937 o 2.937 o 2 937
    if (!/^\d{1,7}$/.test(v)) return null;
    const n = Number(v);
    return n <= PRECIO_MAX ? n : null;
  }
  function alCambiar(item) {
    const { input } = S.filas.get(item.clave);
    const n = leerPrecio(input.value);
    if (n === null) {
      S.invalidos.add(item.clave);
      S.editados.delete(item.clave);
    } else {
      S.invalidos.delete(item.clave);
      if (n === item.original) S.editados.delete(item.clave);
      else S.editados.set(item.clave, { desde: item.original, hasta: n, etiqueta: etiquetaItem(item), pres: item.pres });
    }
    marcarFila(item);
    actualizarResumen();
  }
  function normalizarCampo(item) {
    const { input } = S.filas.get(item.clave);
    const n = leerPrecio(input.value);
    if (n !== null && input.value !== String(n)) input.value = String(n);
  }
  function marcarFila(item) {
    const { input, antes, caja } = S.filas.get(item.clave);
    const invalido = S.invalidos.has(item.clave);
    const cambio = S.editados.get(item.clave);
    input.setAttribute("aria-invalid", invalido ? "true" : "false");
    caja.classList.toggle("cambiado", Boolean(cambio));
    antes.textContent = invalido ? "Use solo números enteros, sin centavos (ej. 150)."
      : cambio ? `Antes: ${numero(cambio.desde)}` : "";
  }
  function filtrar() {
    const q = sinAcentos($("#buscar").value.trim());
    const cid = $("#filtro-categoria").value;
    const soloCambiados = $("#solo-cambiados").checked;
    let visibles = 0;
    for (const seccion of document.querySelectorAll("#lista-precios .categoria")) {
      let enSeccion = 0;
      const deCategoria = !cid || seccion.dataset.cid === cid;
      for (const fila of seccion.querySelectorAll(".plato")) {
        const claves = [...S.items.values()].filter((i) => i.pid === fila.dataset.pid).map((i) => i.clave);
        const cambiada = claves.some((c) => S.editados.has(c) || S.invalidos.has(c));
        const ver = deCategoria && (!q || fila.dataset.buscar.includes(q)) && (!soloCambiados || cambiada);
        fila.hidden = !ver;
        if (ver) enSeccion++;
      }
      seccion.hidden = !enSeccion;
      visibles += enSeccion;
    }
    let vacio = $("#lista-precios .vacio");
    if (!visibles && !vacio) $("#lista-precios").append(el("p", { clase: "vacio", texto: "No hay platos con ese filtro." }));
    if (visibles && vacio) vacio.remove();
  }
  const puedePublicar = () => S.editados.size > 0 && S.invalidos.size === 0 && Boolean(S.token);
  function actualizarResumen() {
    const n = S.editados.size, malos = S.invalidos.size;
    $("#resumen-cambios").textContent = malos ? `Corrija ${malos === 1 ? "1 precio marcado" : malos + " precios marcados"} en rojo.`
      : n ? `${n === 1 ? "1 cambio" : n + " cambios"} sin publicar.` : "Sin cambios.";
    $("#boton-revisar").disabled = S.ocupado || !puedePublicar();
    $("#boton-deshacer").disabled = S.ocupado || (!n && !malos);
  }
  function deshacer() {
    S.editados.clear();
    S.invalidos.clear();
    for (const item of S.items.values()) {
      const f = S.filas.get(item.clave);
      if (f) f.input.value = String(item.original);
      marcarFila(item);
    }
    filtrar();
    actualizarResumen();
    estado("Se deshicieron los cambios.");
  }

  /* ---------- Revisar y publicar ---------- */
  function cambiosOrdenados() {
    return [...S.editados.entries()].map(([clave, c]) => ({ clave, ...c, item: S.items.get(clave) }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  }
  // Cambios grandes o a cero se confirman aparte: un cero de más o de menos es el error más común.
  const llamativo = (c) => c.hasta === 0 || c.desde === 0 || Math.abs(c.hasta - c.desde) / c.desde > 0.5;
  function revisar() {
    if (!puedePublicar()) return;
    const lista = $("#lista-revision");
    lista.replaceChildren();
    const cambios = cambiosOrdenados();
    let marcados = 0;
    for (const c of cambios) {
      const raro = llamativo(c);
      if (raro) marcados++;
      lista.append(el("li", {},
        el("span", { texto: c.etiqueta }),
        el("span", { clase: "valores" + (raro ? " marcado" : ""), texto: `${numero(c.desde)} → ${numero(c.hasta)}${raro ? " ⚠" : ""}` })));
    }
    $("#bloque-confirmar").hidden = !marcados;
    $("#texto-advertencia").textContent = marcados ? `${marcados === 1 ? "Un precio cambia" : marcados + " precios cambian"} mucho o queda en cero (marcados con ⚠). Revise que no falte ni sobre un cero.` : "";
    $("#casilla-confirmar").checked = false;
    $("#error-publicar").textContent = "";
    actualizarBotonPublicar();
    const d = $("#dialogo-revisar");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  function actualizarBotonPublicar() {
    const confirmar = !$("#bloque-confirmar").hidden;
    $("#boton-publicar").disabled = S.ocupado || !puedePublicar() || (confirmar && !$("#casilla-confirmar").checked);
  }
  function mensajeCommit(cambios) {
    const lineas = cambios.map((c) => `${c.etiqueta}: ${c.desde} → ${c.hasta}`);
    const titulo = "Precios (web): " + (cambios.length === 1 ? lineas[0] : `${cambios.length} cambios`);
    return titulo.slice(0, 120) + "\n\n" + lineas.join("\n") + `\n\nPublicado desde el editor de precios de la web${S.usuario ? " por " + S.usuario : ""}.`;
  }

  async function publicar() {
    if (S.ocupado || !puedePublicar()) return;
    const errorCaja = $("#error-publicar");
    errorCaja.textContent = "";
    const cambios = cambiosOrdenados();
    ocupar(true, "Publicando…");
    try {
      // 1. Menú nuevo: el de GitHub con los precios cambiados, nada más.
      const nuevo = aplicarCambios(S.base.datos, S.editados);
      if (sinPrecios(nuevo) !== sinPrecios(S.base.datos)) throw new ErrorUsuario("Comprobación fallida: algo distinto de un precio iba a cambiar. No se publicó nada.");
      const contenido = escribirMenu(S.base.prefijo, nuevo);
      // 2. Se vuelve a leer lo que se va a subir y se confirman los precios uno por uno.
      const releido = indexar(leerMenu(contenido).datos);
      for (const item of S.items.values()) {
        const esperado = S.editados.has(item.clave) ? S.editados.get(item.clave).hasta : item.original;
        const r = releido.get(item.clave);
        if (!r || r.original !== esperado) throw new ErrorUsuario("Comprobación fallida al preparar el archivo. No se publicó nada.");
      }
      // 3. Se publica sobre el archivo exacto que se leyó (sha): si alguien cambió algo, GitHub lo rechaza.
      const respuesta = await gh(`${RUTA_REPO}/contents/${encodeURIComponent(REPO.archivo)}`, {
        metodo: "PUT",
        cuerpo: { message: mensajeCommit(cambios), content: aBase64(texto.encode(contenido)), sha: S.base.sha, branch: REPO.rama },
      });
      const shaNuevo = respuesta && respuesta.content && respuesta.content.sha;
      if (typeof shaNuevo !== "string" || !/^[0-9a-f]{40}$/.test(shaNuevo) || shaNuevo !== await shaBlob(texto.encode(contenido))) {
        throw new ErrorUsuario("GitHub respondió algo inesperado. Recargue la página para ver si el cambio quedó publicado.");
      }
      const enlaceCommit = respuesta.commit && typeof respuesta.commit.html_url === "string"
        && respuesta.commit.html_url.startsWith(WEB_REPO + "/commit/") ? respuesta.commit.html_url : null;
      S.editados.clear();
      reconstruir({ texto: contenido, prefijo: S.base.prefijo, datos: nuevo, sha: shaNuevo });
      pintarLista();
      cerrarDialogo();
      avisoConEnlace(`Publicado: ${cambios.length === 1 ? "1 precio" : cambios.length + " precios"}. La web los mostrará en unos minutos (hasta 10). El menú QR de las mesas los toma cuando se publique desde la computadora del hotel.`,
        enlaceCommit, "Ver el cambio en GitHub");
      estado("Precios publicados.");
      cargarHistorial();
    } catch (e) {
      if (e instanceof ErrorGitHub && (e.estado === 409 || e.estado === 422)) {
        // Alguien publicó mientras tanto: se trae lo nuevo y se conservan los cambios que no chocan.
        try {
          const choques = reconstruir(await cargarMenu());
          pintarLista();
          cerrarDialogo();
          aviso("La carta cambió en GitHub mientras usted editaba. Se cargó la versión nueva" +
            (choques.length ? "; algunos cambios no se conservaron:\n" + choques.join("\n") : " y se conservaron sus cambios.") +
            "\nRevise y vuelva a publicar.");
        } catch (e2) {
          errorCaja.textContent = mensajeError(e2);
        }
      } else {
        errorCaja.textContent = mensajeError(e);
        if (e instanceof ErrorGitHub && e.estado === 401) bloquear(mensajeError(e));
      }
    } finally {
      ocupar(false);
    }
  }

  /* ---------- Historial ---------- */
  async function cargarHistorial() {
    const lista = $("#lista-historial");
    try {
      const commits = await gh(`${RUTA_REPO}/commits?path=${encodeURIComponent(REPO.archivo)}&sha=${encodeURIComponent(REPO.rama)}&per_page=8`);
      if (!Array.isArray(commits)) return;
      lista.replaceChildren(...commits.slice(0, 8).map((c) => {
        const mensaje = String(c && c.commit && c.commit.message || "").split("\n")[0].slice(0, 160);
        const fecha = new Date(c && c.commit && (c.commit.committer || c.commit.author || {}).date);
        const url = c && typeof c.html_url === "string" && c.html_url.startsWith(WEB_REPO + "/commit/") ? c.html_url : null;
        const cuando = Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
        return el("li", {}, el("time", { texto: cuando }), " · ",
          url ? el("a", { href: url, target: "_blank", rel: "noopener noreferrer", texto: mensaje || "Cambio" }) : mensaje);
      }));
    } catch (e) {
      lista.replaceChildren(el("li", { texto: "No se pudo cargar el historial." }));
    }
  }

  /* ---------- Arranque ---------- */
  function iniciar() {
    if (window.opener) {
      // Otra ventana de la misma web podría leer esta página: se pide abrirla directamente.
      try { window.opener = null; } catch (e) { /* nada */ }
      document.body.classList.add("sin-marco");
      aviso("Por seguridad, abra esta página directamente (escriba la dirección o use un marcador), no desde un enlace de otra página.");
      return;
    }
    if (!window.crypto || !crypto.subtle || !window.isSecureContext) {
      document.body.classList.add("sin-marco");
      aviso("Este navegador no ofrece el cifrado necesario. Use una versión reciente de Chrome, Safari, Firefox o Edge, por https.");
      return;
    }
    $("#enlace-crear-token").href = URL_CREAR_TOKEN;
    $("#nombre-repo-ayuda").textContent = REPO.nombre;
    if (!almacen()) {
      $("#casilla-recordar").closest(".casilla").hidden = true;
    }
    $("#casilla-recordar").addEventListener("change", (e) => { $("#bloque-frase").hidden = !e.target.checked; });
    $("#campo-frase-nueva").addEventListener("input", (e) => { $("#medidor-frase").textContent = medirFrase(e.target.value); });
    $("#form-conectar").addEventListener("submit", entrar);
    $("#form-desbloquear").addEventListener("submit", desbloquear);
    $("#boton-olvidar").addEventListener("click", () => {
      if (S.ocupado) return;
      olvidarGuardado();
      bloquear();
      estado("Se borró el token de este dispositivo.");
    });
    $("#boton-bloquear").addEventListener("click", () => bloquear("Sesión bloqueada."));
    $("#buscar").addEventListener("input", filtrar);
    $("#filtro-categoria").addEventListener("change", filtrar);
    $("#solo-cambiados").addEventListener("change", filtrar);
    $("#boton-deshacer").addEventListener("click", deshacer);
    $("#boton-revisar").addEventListener("click", revisar);
    $("#boton-volver").addEventListener("click", cerrarDialogo);
    $("#casilla-confirmar").addEventListener("change", actualizarBotonPublicar);
    $("#boton-publicar").addEventListener("click", publicar);
    document.body.classList.add("sin-marco");
    mostrarPaso(leerGuardado() ? "desbloquear" : "conectar");
  }
  iniciar();
})();
