/* =====================================================================
   EDITOR DE PRECIOS DE LA WEB · Hotel Frontera · Restaurante Las Margaritas

   Funciona en la web de Cloudflare (por ejemplo hotelfronteraocotal.com/precios/).
   Para llegar aquí hay que entrar con Cloudflare Access: se escribe el correo y
   llega un código. Esta página no maneja contraseñas, tokens ni secretos: la
   sesión la lleva Cloudflare en una cookie que JavaScript no puede leer.

   Lo que se guarda va al Worker (worker/index.js), que vuelve a comprobar la
   sesión, el correo autorizado y cada precio antes de guardarlo.

   Seguridad en esta página (OWASP):
   - CSP estricta y Trusted Types: solo código propio; nada de HTML armado con texto.
   - La página se arma con textContent y createElement. Los datos llegan con JSON.parse.
   - No funciona dentro de un marco (además de la cabecera frame-ancestors).
   - Antes de guardar: revisión de cada cambio y confirmación de los que cambian
     mucho o quedan en cero. Si otra persona guardó entretanto, se recarga sin
     pisar su cambio.
   ===================================================================== */
(() => {
  "use strict";

  /* ---------- 0. Nunca dentro de un marco (además de la cabecera frame-ancestors) ---------- */
  if (window.top !== window.self) {
    try { window.top.location = window.self.location.href; } catch (e) { /* el marco lo impide: la página sigue oculta */ }
    return;
  }

  // El editor anterior (con token de GitHub) guardaba el token cifrado en este navegador: se borra.
  try { window.localStorage.removeItem("hofrosa.precios.token.v1"); } catch (e) { /* sin almacenamiento: nada que borrar */ }

  const API = "api/";                     // relativo a /precios/
  const PRECIO_MAX = 1000000;             // el mismo tope que el servidor de pedidos y el Worker
  const PRESENTACIONES = { botella: "Botella", media: "Media botella", trago: "Trago" };
  const $ = (s) => document.querySelector(s);

  const S = {
    usuario: "",
    version: null,
    menu: null,
    items: new Map(),     // clave -> { clave, cid, nombreCat, pid, nombre, pres, n, indice, publicado, valor }
    editados: new Map(),  // clave -> { desde, hasta, etiqueta, pres }
    invalidos: new Set(),
    filas: new Map(),
    historial: [],
    ocupado: false,
  };

  class ErrorUsuario extends Error {}
  class SesionVencida extends Error {}
  class ErrorApi extends Error {
    constructor(estado, cuerpo) {
      super(`API ${estado}`);
      this.estado = estado;
      this.cuerpo = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
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
  const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const textoEs = (v) => (typeof v === "string" ? v : esObjeto(v) && typeof v.es === "string" ? v.es : "");

  let relojEstado = null;
  function estado(mensaje) {
    clearTimeout(relojEstado);
    $("#estado").textContent = mensaje || "";
    if (mensaje) relojEstado = setTimeout(() => { $("#estado").textContent = ""; }, 5000);
  }
  function aviso(mensaje, tipo = "mal") {
    const caja = $("#aviso-general");
    caja.replaceChildren();
    caja.textContent = mensaje || "";
    caja.classList.toggle("ok", tipo === "ok");
    caja.hidden = !mensaje;
  }
  function avisoSesion(mensaje) {
    aviso(mensaje || "Su sesión venció. Vuelva a entrar para seguir (los cambios sin guardar se pierden al recargar).");
    const boton = el("button", { type: "button", clase: "boton-sec", texto: "Entrar de nuevo" });
    boton.addEventListener("click", () => { location.reload(); });
    $("#aviso-general").append(" ", boton);
  }

  /* ---------- API del Worker (misma web; la sesión va en la cookie de Access) ---------- */
  async function api(ruta, { metodo = "GET", cuerpo } = {}) {
    const ctrl = new AbortController();
    const espera = setTimeout(() => ctrl.abort(), 25000);
    let r;
    try {
      r = await fetch(API + ruta, {
        method: metodo,
        headers: Object.assign({ Accept: "application/json" }, cuerpo ? { "Content-Type": "application/json" } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        cache: "no-store", credentials: "same-origin", redirect: "manual", referrerPolicy: "no-referrer", signal: ctrl.signal,
      });
    } catch (e) {
      throw new ErrorUsuario("No hay conexión con la web. Revise internet e intente de nuevo.");
    } finally {
      clearTimeout(espera);
    }
    // Access manda a la página de entrada cuando la sesión venció
    if (r.type === "opaqueredirect" || r.status === 401 || (r.status >= 300 && r.status < 400)) throw new SesionVencida();
    let datos = null;
    try { datos = await r.json(); } catch (e) { datos = null; }
    if (r.status === 403 && datos && datos.error === "acceso") throw new SesionVencida(datos.mensaje);
    if (!r.ok) throw new ErrorApi(r.status, datos);
    if (!esObjeto(datos)) throw new ErrorUsuario("La web respondió algo inesperado. No se cambió nada.");
    return datos;
  }
  function mensajeError(e) {
    if (e instanceof ErrorUsuario) return e.message;
    if (e instanceof ErrorApi) {
      if (e.estado === 404) return "El editor de precios funciona en la web publicada en Cloudflare (su dominio)/precios/. Aquí no hay dónde guardar.";
      if (e.cuerpo && typeof e.cuerpo.mensaje === "string") return e.cuerpo.mensaje;
      if (e.estado >= 500) return "La web tuvo un problema. No se cambió nada; intente en unos minutos.";
      return `La web respondió con un error (${e.estado}). No se cambió nada.`;
    }
    console.error(e);
    return "Ocurrió un error inesperado. No se cambió nada.";
  }

  /* ---------- Precios: misma clave que el Worker ("id", "id@presentación", "id@presentación#n") ---------- */
  const claveDe = (id, pres, n) => (pres ? `${id}@${pres}${n ? "#" + n : ""}` : id);
  const nombrePres = (pres) => PRESENTACIONES[pres] || pres;
  const etiquetaItem = (item) => (item.pres ? `${item.nombre} (${nombrePres(item.pres).toLowerCase()})` : item.nombre);
  const precioValido = (v) => Number.isInteger(v) && v >= 0 && v <= PRECIO_MAX;

  function indexar(menu, pendientes) {
    if (!esObjeto(menu) || !esObjeto(menu.categorias)) throw new ErrorUsuario("La carta llegó con un formato inesperado.");
    const items = new Map();
    for (const [cid, c] of Object.entries(menu.categorias)) {
      if (!esObjeto(c) || !Array.isArray(c.platos)) continue;
      const nombreCat = textoEs(c.nombre) || cid;
      for (const p of c.platos) {
        if (!esObjeto(p) || typeof p.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(p.id)) continue;
        const nombre = textoEs(p.n) || p.id;
        const poner = (clave, pres, n, indice, publicado) => {
          const pend = esObjeto(pendientes) && esObjeto(pendientes[clave]) ? pendientes[clave] : null;
          const valor = pend && pend.desde === publicado && precioValido(pend.valor) ? pend.valor : publicado;
          items.set(clave, { clave, cid, nombreCat, pid: p.id, nombre, pres, n, indice, publicado, valor });
        };
        if (Array.isArray(p.pres) && p.pres.length) {
          const vistas = {};
          p.pres.forEach((par, indice) => {
            if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== "string" || typeof par[1] !== "number") return;
            const n = vistas[par[0]] || 0;
            vistas[par[0]] = n + 1;
            poner(claveDe(p.id, par[0], n), par[0], n, indice, par[1]);
          });
        } else if (typeof p.p === "number") {
          poner(p.id, "", 0, -1, p.p);
        }
      }
    }
    return items;
  }

  // Al recargar (otra persona guardó) se conservan los cambios propios solo si el precio de
  // partida sigue igual; si no, se avisa.
  function reconstruir(menu, pendientes) {
    const anteriores = new Map(S.editados);
    S.menu = menu;
    S.items = indexar(menu, pendientes);
    S.editados.clear();
    S.invalidos.clear();
    const choques = [];
    for (const [clave, cambio] of anteriores) {
      const item = S.items.get(clave);
      if (!item || item.pres !== cambio.pres) { choques.push(`${cambio.etiqueta}: ya no está en la carta como antes.`); continue; }
      if (item.valor === cambio.desde) S.editados.set(clave, { ...cambio, desde: item.valor, etiqueta: etiquetaItem(item) });
      else if (item.valor !== cambio.hasta) choques.push(`${etiquetaItem(item)}: otra persona lo cambió a ${numero(item.valor)} mientras usted editaba. Su cambio (${numero(cambio.hasta)}) no se aplicó.`);
    }
    return choques;
  }

  /* ---------- Cargar ---------- */
  async function cargar() {
    const r = await api("estado");
    if (!Number.isInteger(r.version) || typeof r.usuario !== "string") throw new ErrorUsuario("La web respondió algo inesperado.");
    S.usuario = r.usuario;
    S.version = r.version;
    S.historial = Array.isArray(r.historial) ? r.historial : [];
    const choques = reconstruir(r.menu, r.pendientes);
    pintarLista();
    pintarHistorial();
    $("#sesion-estado").textContent = `Conectado como ${S.usuario}`;
    $("#sesion").hidden = false;
    $("#cargando").hidden = true;
    $("#paso-editar").hidden = false;
    $("#pie-acciones").hidden = false;
    return choques;
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
            value: String(editado ? editado.hasta : item.valor), "aria-describedby": id + "-antes",
          });
          const antes = el("span", { clase: "antes", id: id + "-antes" });
          const caja = el("div", { clase: "precio" }, el("label", { for: id, texto: item.pres ? nombrePres(item.pres) : "Precio" }), input);
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
      if (n === item.valor) S.editados.delete(item.clave);
      else S.editados.set(item.clave, { desde: item.valor, hasta: n, etiqueta: etiquetaItem(item), pres: item.pres });
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
      : cambio ? `Antes: ${numero(cambio.desde)}`
        : item.valor !== item.publicado ? `En el menú QR sigue ${numero(item.publicado)} hasta publicar.` : "";
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
    const vacio = $("#lista-precios .vacio");
    if (!visibles && !vacio) $("#lista-precios").append(el("p", { clase: "vacio", texto: "No hay platos con ese filtro." }));
    if (visibles && vacio) vacio.remove();
  }
  const puedeGuardar = () => S.editados.size > 0 && S.invalidos.size === 0 && S.version !== null;
  function actualizarResumen() {
    const n = S.editados.size, malos = S.invalidos.size;
    $("#resumen-cambios").textContent = malos ? `Corrija ${malos === 1 ? "1 precio marcado" : malos + " precios marcados"} en rojo.`
      : n ? `${n === 1 ? "1 cambio" : n + " cambios"} sin guardar.` : "Sin cambios.";
    $("#boton-revisar").disabled = S.ocupado || !puedeGuardar();
    $("#boton-deshacer").disabled = S.ocupado || (!n && !malos);
  }
  function deshacer() {
    S.editados.clear();
    S.invalidos.clear();
    for (const item of S.items.values()) {
      const f = S.filas.get(item.clave);
      if (f) f.input.value = String(item.valor);
      marcarFila(item);
    }
    filtrar();
    actualizarResumen();
    estado("Se deshicieron los cambios.");
  }

  /* ---------- Historial (lo guarda el Worker: quién, cuándo y qué) ---------- */
  function pintarHistorial() {
    const lista = $("#lista-historial");
    const entradas = S.historial.slice(0, 30).filter(esObjeto);
    if (!entradas.length) { lista.replaceChildren(el("li", { texto: "Todavía no hay cambios guardados desde aquí." })); return; }
    lista.replaceChildren(...entradas.map((e) => {
      const fecha = new Date(Number(e.en));
      const cuando = Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" });
      const lineas = (Array.isArray(e.cambios) ? e.cambios : []).filter(esObjeto);
      let cambios = lineas.map((c) => `${String(c.nombre || c.clave || "")}: ${numero(c.antes)} → ${numero(c.despues)}`).join("; ");
      const total = Number(e.total);
      if (Number.isInteger(total) && total > lineas.length) cambios += ` y ${total - lineas.length} más`;
      return el("li", {}, el("time", { texto: cuando }), ` · ${String(e.quien || "")} · ${cambios}`);
    }));
  }

  /* ---------- Revisar y guardar ---------- */
  function cambiosOrdenados() {
    return [...S.editados.entries()].map(([clave, c]) => ({ clave, ...c }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  }
  // Cambios grandes o a cero se confirman aparte: un cero de más o de menos es el error más común.
  const llamativo = (c) => c.hasta === 0 || c.desde === 0 || Math.abs(c.hasta - c.desde) / c.desde > 0.5;
  function abrirDialogo() {
    const d = $("#dialogo-revisar");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  function cerrarDialogo() {
    const d = $("#dialogo-revisar");
    if (!d.open) return;
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
  }
  function revisar() {
    if (!puedeGuardar()) return;
    const lista = $("#lista-revision");
    lista.replaceChildren();
    let marcados = 0;
    for (const c of cambiosOrdenados()) {
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
    actualizarBotonGuardar();
    abrirDialogo();
  }
  function actualizarBotonGuardar() {
    const confirmar = !$("#bloque-confirmar").hidden;
    $("#boton-publicar").disabled = S.ocupado || !puedeGuardar() || (confirmar && !$("#casilla-confirmar").checked);
  }
  function ocupar(si, mensaje) {
    S.ocupado = si;
    $("#principal").setAttribute("aria-busy", si ? "true" : "false");
    actualizarBotonGuardar();
    actualizarResumen();
    if (mensaje) estado(mensaje);
  }

  async function guardar() {
    if (S.ocupado || !puedeGuardar()) return;
    const errorCaja = $("#error-publicar");
    errorCaja.textContent = "";
    const cambios = cambiosOrdenados();
    for (const c of cambios) {
      if (!precioValido(c.hasta)) { errorCaja.textContent = `El precio de ${c.etiqueta} no es válido.`; return; }
    }
    ocupar(true, "Guardando…");
    try {
      const r = await api("precios", {
        metodo: "PUT",
        cuerpo: { version: S.version, cambios: cambios.map((c) => ({ clave: c.clave, desde: c.desde, valor: c.hasta })) },
      });
      if (!Number.isInteger(r.version) || !esObjeto(r.pendientes)) throw new ErrorUsuario("La web respondió algo inesperado. Recargue para ver si se guardó.");
      S.version = r.version;
      S.historial = Array.isArray(r.historial) ? r.historial : S.historial;
      S.editados.clear();
      reconstruir(S.menu, r.pendientes);
      pintarLista();
      pintarHistorial();
      cerrarDialogo();
      aviso(`Guardado: ${cambios.length === 1 ? "1 precio" : cambios.length + " precios"}. La web los muestra en menos de un minuto. El menú QR de las mesas los recibe al publicar desde la computadora del hotel.`, "ok");
      estado("Precios guardados.");
    } catch (e) {
      if (e instanceof SesionVencida) {
        cerrarDialogo();
        avisoSesion(e.message);
      } else if (e instanceof ErrorApi && e.estado === 409) {
        // Otra persona guardó: se trae lo nuevo y se conservan los cambios que no chocan.
        try {
          const choques = await cargar();
          cerrarDialogo();
          aviso("Otra persona guardó precios mientras usted editaba. Se cargó la versión nueva" +
            (choques.length ? "; algunos cambios no se conservaron:\n" + choques.join("\n") : " y se conservaron sus cambios.") +
            "\nRevise y vuelva a guardar.");
        } catch (e2) {
          if (e2 instanceof SesionVencida) { cerrarDialogo(); avisoSesion(e2.message); } else errorCaja.textContent = mensajeError(e2);
        }
      } else {
        errorCaja.textContent = mensajeError(e);
      }
    } finally {
      ocupar(false);
    }
  }

  /* ---------- Arranque ---------- */
  async function iniciar() {
    $("#buscar").addEventListener("input", filtrar);
    $("#filtro-categoria").addEventListener("change", filtrar);
    $("#solo-cambiados").addEventListener("change", filtrar);
    $("#boton-deshacer").addEventListener("click", deshacer);
    $("#boton-revisar").addEventListener("click", revisar);
    $("#boton-volver").addEventListener("click", cerrarDialogo);
    $("#casilla-confirmar").addEventListener("change", actualizarBotonGuardar);
    $("#boton-publicar").addEventListener("click", guardar);
    window.addEventListener("beforeunload", (e) => {
      if (S.editados.size) { e.preventDefault(); e.returnValue = ""; }
    });
    document.body.classList.add("sin-marco");
    try {
      await cargar();
    } catch (e) {
      $("#cargando").hidden = true;
      if (e instanceof SesionVencida) avisoSesion(e.message);
      else aviso(mensajeError(e));
    }
  }
  iniciar();
})();
