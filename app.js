(() => {
  "use strict";
  const W = window.WEB;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = (plantilla, datos) => plantilla.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? "");

  /* ---------- Menú móvil de navegación ---------- */
  const btn = $(".menu-btn"), nav = $("#nav"), velo = $(".velo"), textoBtn = $(".menu-texto");
  const abierto = () => nav.classList.contains("abierto");
  function ponerNav(abrir) {
    if (abrir === abierto()) return;
    nav.classList.toggle("abierto", abrir);
    btn.setAttribute("aria-expanded", String(abrir));
    textoBtn.textContent = abrir ? textoBtn.dataset.cerrar : textoBtn.dataset.abrir;
    document.documentElement.classList.toggle("nav-abierta", abrir);
    if (abrir) { velo.hidden = false; requestAnimationFrame(() => velo.classList.add("visible")); }
    else { velo.classList.remove("visible"); setTimeout(() => { if (!abierto()) velo.hidden = true; }, 300); }
  }
  const cerrarNav = () => ponerNav(false);
  btn.addEventListener("click", () => ponerNav(!abierto()));
  nav.addEventListener("click", e => { if (e.target.closest("a:not([data-idioma])")) cerrarNav(); });
  velo.addEventListener("click", cerrarNav);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && abierto()) { cerrarNav(); btn.focus(); } });
  document.addEventListener("click", e => {
    if (abierto() && !e.target.closest("header")) cerrarNav();
    // El desplegable de idiomas se cierra al tocar fuera de él
    document.querySelectorAll(".selector-idioma[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", e => {
    const d = document.querySelector(".selector-idioma[open]");
    if (e.key === "Escape" && d) { d.open = false; d.querySelector("summary").focus(); e.stopImmediatePropagation(); }
  }, true);
  // Si el foco sale del menú abierto (Tab), se cierra para no dejarlo tapando la página
  $("header").addEventListener("focusout", e => { if (abierto() && e.relatedTarget && !e.relatedTarget.closest("header")) cerrarNav(); });
  matchMedia("(min-width:941px)").addEventListener("change", cerrarNav);

  /* ---------- Carrusel de la portada: fundido suave entre fotos ---------- */
  (() => {
    const caja = $(".carrusel");
    if (!caja) return;
    const diapos = [...caja.querySelectorAll(".diapositiva")];
    if (diapos.length < 2) return;
    const puntos = caja.querySelector(".carrusel-puntos"), pausa = caja.querySelector(".carrusel-pausa");
    const quieto = matchMedia("(prefers-reduced-motion: reduce)");
    const INTERVALO = 6500;
    let actual = 0, reloj = null, pausadoPorUsuario = quieto.matches, enVista = true;

    const cargar = i => {
      const img = diapos[i].querySelector("img");
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    };
    puntos.innerHTML = diapos.map((d, i) => `<button type="button" aria-label="Foto ${i + 1} de ${diapos.length}: ${esc(d.querySelector("img").alt)}"${i ? "" : ' aria-current="true"'}></button>`).join("");
    const botones = [...puntos.children];

    async function ir(i) {
      i = (i + diapos.length) % diapos.length;
      if (i === actual) return;
      await cargar(i);                       // no se cambia hasta que la foto está lista
      diapos[actual].classList.remove("activa");
      diapos[i].classList.add("activa");
      botones[actual].removeAttribute("aria-current");
      botones[i].setAttribute("aria-current", "true");
      actual = i;
      cargar((i + 1) % diapos.length);       // la siguiente se prepara con tiempo
    }
    const detener = () => { clearInterval(reloj); reloj = null; };
    const arrancar = () => { detener(); if (!pausadoPorUsuario && enVista && !document.hidden) reloj = setInterval(() => ir(actual + 1), INTERVALO); };
    const marcarPausa = () => { pausa.setAttribute("aria-pressed", String(pausadoPorUsuario)); pausa.setAttribute("aria-label", pausadoPorUsuario ? "Reanudar las fotos" : "Pausar las fotos"); };

    botones.forEach((b, i) => b.addEventListener("click", () => { ir(i); arrancar(); }));
    pausa.addEventListener("click", () => { pausadoPorUsuario = !pausadoPorUsuario; marcarPausa(); arrancar(); });
    document.addEventListener("visibilitychange", arrancar);
    quieto.addEventListener?.("change", e => { pausadoPorUsuario = e.matches; marcarPausa(); arrancar(); });
    // Solo avanza mientras se ve: ahorra datos y batería
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { enVista = e.isIntersecting; arrancar(); }).observe(caja);
    // Deslizar con el dedo
    let x0 = null;
    caja.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    caja.addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { ir(actual + (dx < 0 ? 1 : -1)); arrancar(); }
    });
    caja.querySelector(".carrusel-controles").hidden = false;
    marcarPausa();
    cargar(1);
    arrancar();
  })();

  // Los anclajes respetan la altura real de ambas barras, también con zoom.
  const cabecera = $("header"), barraMenu = $(".barra-menu");
  const medirBarras = () => {
    document.documentElement.style.setProperty("--alto-cabecera", `${cabecera.getBoundingClientRect().height}px`);
    document.documentElement.style.setProperty("--alto-barra-menu", `${barraMenu.getBoundingClientRect().height}px`);
  };
  if ("ResizeObserver" in window) {
    const observador = new ResizeObserver(medirBarras);
    observador.observe(cabecera);
    observador.observe(barraMenu);
  } else window.addEventListener("resize", medirBarras);
  medirBarras();

  /* Se valida el formato que consume la carta antes de aceptar el menú remoto. */
  function menuValido(D) {
    const objeto = v => v !== null && typeof v === "object" && !Array.isArray(v);
    const texto = v => typeof v === "string" || (objeto(v) && Object.values(v).every(t => typeof t === "string"));
    const opcional = (v, validar) => v == null || validar(v);
    const numero = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
    const lista = (v, validar) => Array.isArray(v) && v.every(validar);
    const plato = p => objeto(p) && typeof p.id === "string" && texto(p.n)
      && opcional(p.d, texto) && opcional(p.foto, v => typeof v === "string")
      && opcional(p.fotoReferencia, v => typeof v === "boolean")
      && opcional(p.incluye, v => typeof v === "string") && opcional(p.p, numero)
      && opcional(p.t, v => lista(v, t => typeof t === "string"))
      && opcional(p.op, v => lista(v, texto))
      && opcional(p.pres, v => lista(v, a => Array.isArray(a) && a.length === 2 && typeof a[0] === "string" && numero(a[1])));
    if (!objeto(D) || !objeto(D.categorias) || !objeto(D.momentos) || !Object.keys(D.momentos).length) return false;
    if (!Object.values(D.categorias).every(c => objeto(c) && texto(c.nombre) && lista(c.platos, plato)
      && opcional(c.resumen, texto) && opcional(c.nota, texto)
      && opcional(c.incluye, v => typeof v === "string") && opcional(c.foto, v => typeof v === "string")
      && opcional(c.fotoReferencia, v => typeof v === "boolean"))) return false;
    if (!Object.values(D.momentos).every(m => objeto(m) && lista(m.grupos, g => objeto(g) && texto(g.n)
      && opcional(g.nota, texto) && lista(g.cats, id => typeof id === "string" && Object.hasOwn(D.categorias, id))))) return false;
    const C = D.config;
    if (C != null) {
      if (!objeto(C) || !opcional(C.bebidasDesayuno, v => lista(v, id => typeof id === "string"))
        || !opcional(C.moneda, v => typeof v === "string") || !opcional(C.iva, numero)) return false;
      if (!opcional(C.horario, h => objeto(h) && Object.values(h).every(v => objeto(v)
        && typeof v.desde === "string" && typeof v.hasta === "string"))) return false;
      if (!opcional(C.hotel, h => objeto(h) && opcional(h.lema, texto) && opcional(h.direccion, texto)
        && opcional(h.correo, v => typeof v === "string")
        && opcional(h.telefonos, v => lista(v, t => objeto(t) && typeof t.tel === "string" && typeof t.texto === "string"))
        && opcional(h.celular, t => objeto(t) && typeof t.tel === "string" && typeof t.texto === "string"))) return false;
    }
    return true;
  }

  /* ---------- Carga de datos: servidor en vivo o copia local ---------- */
  async function cargar() {
    if (W.servidor) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), W.esperaMs);
      try {
        const r = await fetch(W.servidor.replace(/\/+$/, "") + "/api/menu", { signal: ctrl.signal, cache: "no-store" });
        if (!r.ok) throw new Error(`Respuesta del menú: ${r.status}`);
        const d = await r.json();
        if (!menuValido(d)) throw new Error("Formato de menú no válido");
        return { datos: d, vivo: true };
      } catch (e) {
        console.warn("Menú en vivo no disponible, se usa la copia local.", e);
      } finally { clearTimeout(t); }
    }
    return { datos: menuValido(window.MENU_RESPALDO) ? window.MENU_RESPALDO : null, vivo: false };
  }

  /* ---------- Utilidades que dependen de los datos ---------- */
  function preparar(D) {
    const C = D.config || {};
    const idioma = W.idioma || document.documentElement.lang || C.idiomaBase || "es";
    // Texto en el idioma de la página: primero el del dato, luego la caché de
    // traducciones del servidor (menú en vivo) y, si no hay, el español.
    const cache = (D.traducciones || {})[idioma] || {};
    const tx = v => {
      if (v == null) return "";
      const es = typeof v === "string" ? v : (v.es ?? Object.values(v)[0] ?? "");
      return (typeof v === "object" && v[idioma]) || cache[es] || es;
    };
    const moneda = C.moneda || "C$";
    const dinero = n => {
      const num = Number(n);
      if (!Number.isFinite(num)) return "";
      let s = (W.simboloPorPrecio ? moneda + " " : "") + num.toLocaleString(idioma === "es" ? "es-NI" : idioma, { minimumFractionDigits: num % 1 ? 2 : 0, maximumFractionDigits: 2 });
      if (W.mostrarDolares && C.tipoCambio > 0) s += ` (US$ ${(num / C.tipoCambio).toFixed(2)})`;
      return s;
    };
    const hora = h => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(h || "");
      if (!m) return h || "";
      const H = +m[1];
      return `${(H % 12) || 12}:${m[2]} ${H < 12 ? "a.m." : "p.m."}`;
    };
    // Índice de platos por id (para nombrar bebidas incluidas, etc.)
    const platos = {};
    for (const c of Object.values(D.categorias || {})) for (const p of c.platos || []) platos[p.id] = p;
    // Fotos subidas desde el panel viven en el servidor de pedidos
    // «fotos/…» son las que sube el panel del servidor de pedidos; el resto
    // (p. ej. assets/imagenes/platos/… del editor de la web) son archivos de esta web.
    const urlFoto = f => !f ? "" : /^https?:/.test(f) || !/^\/?fotos\//.test(f) || !W.servidor ? f : W.servidor.replace(/\/+$/, "") + "/" + f.replace(/^\/+/, "");
    return { C, tx, dinero, hora, platos, urlFoto };
  }

  // Las fotos de la web son locales; p.foto puede venir del servidor de pedidos.
  function mediaHTML(p, U, grande = false) {
    const configurada = W.imagenes.platos?.[p.id];
    const imagen = typeof configurada === "string" ? { src: configurada } : configurada;
    const foto = configurada !== undefined ? imagen?.src : U.urlFoto(p.foto);
    if (!foto) return "";
    const referencia = configurada !== undefined ? imagen?.fotoReferencia : p.fotoReferencia;
    return `<figure class="${grande ? "plato-media" : "miniatura"}${referencia ? " foto-referencia" : ""}">
      <img data-menu-foto src="${esc(foto)}" alt="${esc(U.tx(imagen?.alt || p.n))}${referencia ? ` (${esc(W.textos.fotoReferencia)})` : ""}" width="960" height="640" loading="lazy" decoding="async">
      ${referencia ? `<figcaption>${esc(grande ? W.textos.fotoReferencia : W.textos.referenciaBreve)}</figcaption>` : ""}
    </figure>`;
  }

  function platoHTML(p, cat, U, destacado = false, notaFuerte = true) {
    const etiquetas = (p.t || []).filter(t => W.etiquetas[t]).map(t => `<span class="etiqueta">${esc(W.etiquetas[t])}</span>`).join("")
      + (p.agotado ? `<span class="etiqueta agotado">${esc(W.textos.agotado)}</span>` : "");
    const tienePres = Array.isArray(p.pres) && p.pres.length;
    const precio = tienePres ? "" : (p.p != null ? U.dinero(p.p) : "");
    const pres = tienePres ? `<div class="pres">${p.pres.map(([k, v]) => `<span>${esc(W.presentaciones[k] || k)} <b translate="no" class="notranslate">${esc(U.dinero(v))}</b></span>`).join("")}</div>` : "";
    const ops = Array.isArray(p.op) && p.op.length ? `<div class="ops">${p.op.map(o => `<span>${esc(U.tx(o))}</span>`).join("")}</div>` : "";
    const incluye = p.incluye ?? cat.incluye;
    let nota = "";
    if (incluye === "desayuno") {
      const lista = (U.C.bebidasDesayuno || []).map(id => U.platos[id] && !U.platos[id].agotado ? U.tx(U.platos[id].n) : null).filter(Boolean);
      nota = lista.length ? fmt(W.textos.incluyeDesayuno, { lista: lista.join(", ").toLowerCase() }) : "";
    } else if (incluye === "fuerte" && notaFuerte) nota = W.textos.incluyeFuerte;
    const detalles = `
      ${p.d ? `<div class="desc">${esc(U.tx(p.d))}</div>` : ""}
      ${ops}${pres}${nota ? `<div class="desc">${esc(nota)}</div>` : ""}`;
    const media = mediaHTML(p, U, destacado);
    if (destacado) return `<article class="especial trazo" data-plato="${esc(p.id)}">
      ${media}<div class="especial-cuerpo">
        <span class="sello">${esc(U.tx(cat.nombre))}</span>
        <div class="fila"><h4>${esc(U.tx(p.n))}</h4>${precio ? `<span class="precio notranslate" translate="no">${esc(precio)}</span>` : ""}</div>
        ${etiquetas ? `<div class="etiquetas">${etiquetas}</div>` : ""}${detalles}
      </div></article>`;
    return `<div class="plato${media ? " con-foto" : ""}${p.agotado ? " agotado" : ""}" data-plato="${esc(p.id)}">
      <div class="plato-cuerpo">
        <div class="plato-encabezado">${media}<div class="plato-datos">
          <div class="fila"><span class="nombre">${esc(U.tx(p.n))}</span>${precio ? `<span class="precio notranslate" translate="no">${esc(precio)}</span>` : ""}</div>
          ${etiquetas ? `<div class="etiquetas">${etiquetas}</div>` : ""}
        </div></div>${detalles}
      </div></div>`;
  }

  function seleccionarRecomendados(entradas) {
    const R = W.recomendaciones;
    const candidatos = entradas.filter(({ p }) => !p.agotado && (p.t || []).some(t => R.etiquetas.includes(t)));
    const elegidos = [], porCat = new Map();
    const agregar = e => {
      if (elegidos.length >= R.maximo || elegidos.some(x => x.p.id === e.p.id) || (porCat.get(e.cid) || 0) >= R.porCategoria) return;
      elegidos.push(e); porCat.set(e.cid, (porCat.get(e.cid) || 0) + 1);
    };
    // Se respeta el orden de la carta y se ofrece variedad de categorías.
    candidatos.forEach(agregar);
    return elegidos;
  }

  // Si el grupo ya trae su nota (p. ej. «Con ensalada, arroz y papas»), no se repite
  // en cada categoría ni en cada plato.
  function categoriaHTML(cid, c, U, notaEnGrupo = false) {
    const todosFuertes = c.platos.every(p => (p.incluye ?? c.incluye) === "fuerte");
    const configurada = W.imagenes.categorias[cid];
    const imagen = typeof configurada === "string" ? { src: configurada } : configurada;
    const foto = configurada !== undefined ? imagen?.src : U.urlFoto(c.foto);
    const referencia = configurada !== undefined ? imagen?.fotoReferencia : c.fotoReferencia;
    return `<article class="cat trazo" data-categoria="${esc(cid)}">
      ${foto ? `<figure class="cat-imagen"><img data-menu-foto src="${esc(foto)}" alt="${esc(U.tx(imagen?.alt || c.nombre))}" width="960" height="640" loading="lazy">${referencia ? `<figcaption>${esc(W.textos.fotoReferencia)}</figcaption>` : ""}</figure>` : ""}
      <div class="cat-cabecera"><div><h4>${esc(U.tx(c.nombre))}</h4>
        ${c.resumen ? `<p class="resumen-c">${esc(U.tx(c.resumen))}</p>` : ""}
      </div></div>
      ${c.nota ? `<p class="nota-c">${esc(U.tx(c.nota))}</p>` : ""}
      ${todosFuertes && !notaEnGrupo ? `<p class="nota-c">${esc(W.textos.incluyeFuerte)}</p>` : ""}
      ${c.platos.map(p => platoHTML(p, c, U, false, !todosFuertes && !notaEnGrupo)).join("")}
    </article>`;
  }

  function pintarContacto(C, tx) {
    const h = C.hotel;
    if (!h) return;
    const tels = h.telefonos || [];
    if (h.lema) document.querySelectorAll('[data-hotel="lema"]').forEach(el => el.textContent = tx(h.lema));
    document.querySelectorAll('[data-hotel="direccion"]').forEach(el => { el.textContent = tx(h.direccion); });
    if (tels[0]) {
      document.querySelectorAll('[data-hotel="reservar"]').forEach(r => { r.href = "tel:" + tels[0].tel; r.textContent = fmt(W.textos.reservar, { tel: tels[0].texto }); });
      document.querySelectorAll('[data-hotel="tel1"]').forEach(a => { a.href = "tel:" + tels[0].tel; });
    }
    const li = [];
    if (tels.length) li.push(esc(W.textos.tel) + " " + tels.map(t => `<a href="tel:${esc(t.tel)}">${esc(t.texto)}</a>`).join(" · "));
    if (h.celular) li.push(`${esc(W.textos.cel)} <a href="tel:${esc(h.celular.tel)}">${esc(h.celular.texto)}</a>`);
    if (h.correo) li.push(`<a href="mailto:${esc(h.correo)}">${esc(h.correo)}</a>`);
    if (li.length && $('[data-hotel="contacto"]')) $('[data-hotel="contacto"]').innerHTML = li.map(x => `<li>${x}</li>`).join("");
  }

  function iniciarMenu(D, U, vivo) {
    const ids = Object.keys(D.momentos || {});
    const pest = $("#pestanas"), carta = $("#carta"), hor = $("#horario");
    const nombre = id => W.momentos[id] || (id.charAt(0).toUpperCase() + id.slice(1));
    const abiertosPorMomento = new Map();
    let momentoActual;

    function actualizarControl() {
      const boton = carta.querySelector("[data-expandir-carta]");
      if (!boton) return;
      const secciones = [...carta.querySelectorAll(".seccion-menu")];
      const accion = secciones.every(s => s.open) ? "cerrar" : "abrir";
      // No se reemplaza el texto ya traducido cuando la acción no ha cambiado.
      if (boton.dataset.accion !== accion) {
        boton.dataset.accion = accion;
        boton.textContent = accion === "cerrar" ? W.textos.cerrarSecciones : W.textos.verCartaCompleta;
      }
    }

    function abrirDestinoHash(enfocar = false) {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const destino = document.getElementById(id);
      if (!destino || !carta.contains(destino)) return;
      const seccion = destino.closest(".seccion-menu");
      if (!seccion) return;
      seccion.open = true;
      actualizarControl();
      const desplazar = () => {
        const tapa = cabecera.getBoundingClientRect().height + barraMenu.getBoundingClientRect().height + 8;
        window.scrollTo({ top: seccion.getBoundingClientRect().top + window.scrollY - tapa, behavior: "instant" });
      };
      requestAnimationFrame(() => {
        desplazar();
        if (enfocar) seccion.querySelector("summary").focus({ preventScroll: true });
      });
      // Al abrir la web con #ancla, fuentes e imágenes pueden mover la página después.
      if (document.readyState !== "complete") window.addEventListener("load", () => requestAnimationFrame(desplazar), { once: true });
      document.fonts?.ready.then(() => requestAnimationFrame(desplazar));
    }

    carta.addEventListener("click", e => {
      if (!e.target.closest("[data-expandir-carta]")) return;
      const secciones = [...carta.querySelectorAll(".seccion-menu")];
      const abrir = !secciones.every(s => s.open);
      secciones.forEach(s => { s.open = abrir; });
      actualizarControl();
    });
    carta.addEventListener("toggle", e => {
      if (e.target.matches(".seccion-menu")) actualizarControl();
    }, true);
    window.addEventListener("hashchange", () => abrirDestinoHash(true));
    // Una foto ausente o rota deja la carta de texto, sin huecos ni ilustraciones.
    $("#menu-rest").addEventListener("error", e => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-menu-foto")) return;
      const caja = img.parentElement;
      if (caja.classList.contains("miniatura")) caja.closest(".plato")?.classList.remove("con-foto");
      caja.remove();
    }, true);

    // Horarios en el pie
    const hhmm = h => /^\d:/.test(h || "") ? "0" + h : (h || "");
    const horario = Object.fromEntries(Object.entries(U.C.horario || {}).map(([k, v]) => [k, { desde: hhmm(v.desde), hasta: hhmm(v.hasta) }]));
    const lineas = ids.filter(id => horario[id]).map(id => `<li>${esc(fmt(W.textos.horarioLinea, { nombre: nombre(id), desde: U.hora(horario[id].desde), hasta: U.hora(horario[id].hasta) }))}</li>`);
    if (lineas.length && $('[data-hotel="horarios"]')) $('[data-hotel="horarios"]').innerHTML = lineas.join("");

    $("#nota-precios").textContent = fmt(W.textos.sinIva, {
      moneda: U.C.moneda === "C$" || !U.C.moneda ? W.textos.monedaLocal : U.C.moneda,
      iva: Math.round((U.C.iva ?? 0.15) * 100) + " %",
    });

    pest.innerHTML = ids.map(id => `<button class="trazo" type="button" role="tab" id="tab-${esc(id)}" data-id="${esc(id)}" aria-selected="false" aria-controls="carta" tabindex="-1">${esc(nombre(id))}</button>`).join("");

    function mostrar(id, enfocar) {
      const m = D.momentos[id];
      if (!m) return;
      if (momentoActual) abiertosPorMomento.set(momentoActual, new Set([...carta.querySelectorAll(".seccion-menu[open]")].map(s => s.id)));
      momentoActual = id;
      pest.querySelectorAll("button").forEach(b => {
        const sel = b.dataset.id === id;
        b.setAttribute("aria-selected", String(sel));
        b.tabIndex = sel ? 0 : -1;
        if (sel) {
          if (enfocar) b.focus({ preventScroll: true });
        }
      });
      carta.setAttribute("aria-labelledby", "tab-" + id);
      carta.removeAttribute("aria-label");
      const h = horario[id];
      hor.textContent = h ? fmt(W.textos.horario, { desde: U.hora(h.desde), hasta: U.hora(h.hasta) }) : "";
      const grupos = (m.grupos || []).map((g, i) => ({
        ...g, ancla: `carta-grupo-${i}`,
        categorias: (g.cats || []).map(cid => [cid, D.categorias[cid]]).filter(([, c]) => c?.platos?.length),
      })).filter(g => g.categorias.length);
      const categorias = [...new Map(grupos.flatMap(g => g.categorias)).entries()];
      const entradas = categorias.flatMap(([cid, c]) => c.platos.map(p => ({ cid, c, p })));
      const recomendados = seleccionarRecomendados(entradas);
      const compartir = entradas.filter(({ p }) => !p.agotado && ((p.t || []).some(t => W.compartir.etiquetas.includes(t)) || (W.compartir.ids || []).includes(p.id))).slice(0, W.compartir.maximo);
      const secciones = [
        ...(recomendados.length ? [{
          ancla: "carta-recomendados", n: W.textos.recomendados,
          resumen: W.textos.notaRecomendados, cantidad: recomendados.length,
          contenido: `<div class="especiales">${recomendados.map(({ p, c }) => platoHTML(p, c, U, true)).join("")}</div>`,
        }] : []),
        ...(compartir.length ? [{
          ancla: "carta-compartir", n: W.textos.compartir,
          resumen: W.textos.notaCompartir, cantidad: compartir.length,
          contenido: `<div class="compartir-grid">${compartir.map(({ p, c }) => `<div class="cat trazo">${platoHTML(p, c, U)}</div>`).join("")}</div>`,
        }] : []),
        ...grupos.map(g => ({
          ...g,
          resumen: g.categorias.map(([, c]) => U.tx(c.nombre)).join(" · "),
          cantidad: g.categorias.reduce((n, [, c]) => n + c.platos.length, 0),
          contenido: `${g.nota ? `<p class="nota-seccion">${esc(U.tx(g.nota))}</p>` : ""}<div class="cats">${g.categorias.map(([cid, c]) => categoriaHTML(cid, c, U, Boolean(g.nota))).join("")}</div>`,
        })),
      ];
      const abiertos = abiertosPorMomento.get(id) || new Set();
      const hayFotosReferencia = entradas.some(({ p }) => Boolean(p.foto && p.fotoReferencia) || Boolean(W.imagenes.platos?.[p.id]?.fotoReferencia))
        || categorias.some(([cid, c]) => Boolean(c.foto && c.fotoReferencia) || Boolean(W.imagenes.categorias[cid]?.fotoReferencia));
      carta.innerHTML = entradas.length ? `
        ${hayFotosReferencia ? `<p class="aviso-fotos">${esc(W.textos.avisoFotos)}</p>` : ""}
        <div class="guia-carta">
          <button class="control-carta" type="button" data-expandir-carta aria-controls="carta-secciones">${esc(W.textos.verCartaCompleta)}</button>
        </div>
        <div id="carta-secciones" class="carta-secciones">
          ${secciones.map(s => `<details class="seccion-menu" id="${esc(s.ancla)}"${abiertos.has(s.ancla) ? " open" : ""}>
            <summary><h3 class="seccion-titulo">
              <span class="seccion-textos"><span class="seccion-nombre">${esc(U.tx(s.n))}</span><span class="seccion-pista">${esc(U.tx(s.resumen))}</span></span>
              <span class="seccion-cantidad">${esc(fmt(s.cantidad === 1 ? W.textos.unaOpcion : W.textos.numeroOpciones, { n: s.cantidad }))}</span>
              <span class="seccion-indicador" aria-hidden="true"></span>
            </h3></summary>
            <div class="contenido-seccion">${s.contenido}</div>
          </details>`).join("")}
        </div>
      ` : `<p class="aviso">${esc(W.textos.sinPlatos)}</p>`;
      actualizarControl();
    }

    pest.addEventListener("click", e => { const b = e.target.closest("button"); if (b) mostrar(b.dataset.id); });
    pest.addEventListener("keydown", e => {
      const i = ids.indexOf(document.activeElement?.dataset?.id);
      if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      mostrar(ids[(n + ids.length) % ids.length], true);
    });

    // Pestaña inicial según la hora del restaurante
    let ahora = "";
    try {
      ahora = new Date().toLocaleTimeString("en-GB", { timeZone: U.C.zonaHoraria || "America/Managua", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch { ahora = new Date().toTimeString().slice(0, 5); }
    const enHora = ids.find(id => {
      const h = horario[id];
      if (!h) return false;
      return h.desde <= h.hasta ? ahora >= h.desde && ahora < h.hasta : ahora >= h.desde || ahora < h.hasta;
    });
    mostrar(enHora || ids.find(id => id !== "desayuno") || ids[0]);
    abrirDestinoHash();
    if (vivo) console.info("Menú cargado en vivo desde", W.servidor);
  }

  cargar().then(({ datos, vivo }) => {
    if (!datos) throw new Error("No hay un menú válido disponible");
    const U = preparar(datos);
    pintarContacto(U.C, U.tx);
    iniciarMenu(datos, U, vivo);
  }).catch(e => {
    console.error("No se pudo mostrar la carta.", e);
    $("#pestanas").replaceChildren();
    $("#carta").removeAttribute("aria-labelledby");
    $("#carta").setAttribute("aria-label", "Carta no disponible");
    $("#carta").innerHTML = `<p class="aviso" role="status">${esc(fmt(W.textos.sinMenu, { tel: "2732-2668" }))} <a href="tel:+50527322668">Llamar al restaurante</a></p>`;
  });
})();
