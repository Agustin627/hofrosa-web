/* Google Translate traduce el contenido original, incluida la carta dinámica. */
(() => {
  "use strict";
  const codigos = { es: "es", en: "en", zh: "zh-CN" };
  const clavePreferencia = "hofrosa.idioma";
  const contenedor = document.querySelector("#google_translate_element");
  const estado = document.querySelector("#estado-idiomas");
  const enlaces = [...document.querySelectorAll("[data-idioma]")];
  const normalizar = valor => {
    const base = String(valor || "").toLowerCase().split(/[-_]/)[0];
    return Object.prototype.hasOwnProperty.call(codigos, base) ? base : null;   // Object.hasOwn falta en iOS < 15.4
  };
  const idiomaURL = () => new URL(location.href).searchParams.get("lang");
  let guardado, cookie;
  try { guardado = localStorage.getItem(clavePreferencia); } catch { /* Modo privado: la URL conserva la selección. */ }
  try { cookie = decodeURIComponent(document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/)?.[1] || "").split("/").pop(); } catch { /* Una cookie inválida no impide abrir la web. */ }
  const inicial = idiomaURL() !== null ? normalizar(idiomaURL()) || "es" : normalizar(guardado) || normalizar(cookie) || "es";
  let promesaGoogle, instancia, selector, secuencia = 0, cambioProgramatico = false, recargarAlReintentar = false;

  // El menú siempre se genera en español. Google traduce los nodos que se añaden.
  window.WEB.idioma = "es";

  function guardar(idioma) {
    try { localStorage.setItem(clavePreferencia, idioma); } catch { /* Sin almacenamiento, el selector sigue funcionando. */ }
  }
  const etiquetaActual = document.querySelector(".idioma-actual");
  const resumenSelector = document.querySelector(".selector-idioma summary");
  function marcar(idioma) {
    enlaces.forEach(enlace => {
      if (enlace.dataset.idioma === idioma) {
        enlace.setAttribute("aria-current", "true");
        // El selector muestra arriba el idioma en uso
        if (etiquetaActual) etiquetaActual.textContent = enlace.getAttribute("aria-label");
        resumenSelector?.setAttribute("aria-label", `Idioma: ${enlace.getAttribute("aria-label")}. Elegir otro idioma`);
      } else enlace.removeAttribute("aria-current");
    });
    document.querySelectorAll(".selector-idioma[open]").forEach(d => { d.open = false; });
  }
  function actualizarEnlaces() {
    enlaces.forEach(enlace => {
      const url = new URL(location.href);
      url.searchParams.set("lang", enlace.dataset.idioma);
      enlace.href = url.href;
    });
  }
  function actualizarURL(idioma, modo = "push") {
    const url = new URL(location.href);
    url.searchParams.set("lang", idioma);
    if (url.href !== location.href) {
      try { history[modo === "push" ? "pushState" : "replaceState"]({ ...history.state, hofrosaIdioma: idioma }, "", url); } catch { /* Algunos navegadores limitan History en file://. */ }
    }
    actualizarEnlaces();
  }
  function limpiarCookie() {
    document.cookie = "googtrans=; Max-Age=0; path=/";
    const dominios = new Set([location.hostname, location.hostname.replace(/^www\./, "")]);
    dominios.forEach(dominio => {
      if (dominio.includes(".") && !/^[\d.]+$/.test(dominio)) {
        document.cookie = `googtrans=; Max-Age=0; path=/; domain=.${dominio}`;
      }
    });
  }
  function establecerCookie(idioma) {
    limpiarCookie();
    if (idioma !== "es") document.cookie = `googtrans=/es/${codigos[idioma]}; path=/; SameSite=Lax`;
  }
  function informar(mensaje = "") {
    estado.textContent = mensaje;
    estado.hidden = !mensaje;
  }

  function cargarGoogle() {
    if (selector) return Promise.resolve(selector);
    if (promesaGoogle) return promesaGoogle;
    promesaGoogle = new Promise((resolver, rechazar) => {
      let observador, script;
      const terminar = error => {
        clearTimeout(reloj);
        observador?.disconnect();
        if (error) { script?.remove(); rechazar(error); }
        else resolver(selector);
      };
      const comprobar = () => {
        const combo = contenedor.querySelector(".goog-te-combo");
        if (!combo || ![...combo.options].some(o => o.value === "en")) return;
        selector = combo;
        selector.setAttribute("aria-label", "Google Translate: idioma / language / 语言");
        selector.addEventListener("change", () => {
          if (cambioProgramatico) return;
          const elegido = normalizar(selector.value);
          if (!elegido) return;
          ++secuencia;
          guardar(elegido); marcar(elegido); actualizarURL(elegido, "replace");
        });
        terminar();
      };
      const reloj = setTimeout(() => terminar(new Error("Google Translate no respondió")), 15000);
      observador = new MutationObserver(comprobar);
      observador.observe(contenedor, { childList: true, subtree: true });
      window.googleTranslateElementInit = () => {
        try {
          instancia = new google.translate.TranslateElement({
            pageLanguage: "es", includedLanguages: "en,zh-CN", autoDisplay: false,
          }, "google_translate_element");
          comprobar();
        } catch (error) { terminar(error); }
      };
      if (window.google?.translate?.TranslateElement) window.googleTranslateElementInit();
      else {
        script = document.createElement("script");
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        script.onerror = () => terminar(new Error("No se pudo cargar Google Translate"));
        document.head.appendChild(script);
      }
    }).catch(error => { promesaGoogle = null; throw error; });
    return promesaGoogle;
  }

  async function cambiar(valor, modificarURL = true) {
    const idioma = normalizar(valor) || "es", turno = ++secuencia;
    if (idioma === "es") {
      guardar("es"); establecerCookie("es"); marcar("es"); informar();
      if (modificarURL) actualizarURL("es");
      // Recargar restaura exactamente el original y limpia las marcas de Google.
      if (instancia || promesaGoogle || recargarAlReintentar || document.documentElement.lang !== "es") location.reload();
      return;
    }
    // Google conserva una instancia única: tras una carga parcial hay que recrear la página.
    // Solo se recarga ante un nuevo clic, nunca automáticamente al fallar.
    if (recargarAlReintentar) {
      guardar(idioma); establecerCookie(idioma);
      if (modificarURL) actualizarURL(idioma);
      location.reload();
      return;
    }
    informar("Cargando Google Translate… / Loading… / 正在加载…");
    document.querySelector(".idiomas").setAttribute("aria-busy", "true");
    try {
      const combo = await cargarGoogle();
      if (turno !== secuencia) return;
      guardar(idioma); marcar(idioma);
      if (modificarURL) actualizarURL(idioma);
      combo.value = codigos[idioma];
      cambioProgramatico = true;
      try { combo.dispatchEvent(new Event("change", { bubbles: true })); }
      finally { cambioProgramatico = false; }
      informar();
    } catch (error) {
      if (turno !== secuencia) return;
      console.warn("Google Translate no está disponible.", error);
      recargarAlReintentar = Boolean(window.google?.translate?.TranslateElement);
      informar("Google Translate no está disponible. Revise la conexión y vuelva a elegir el idioma. / Please check your connection and try again.");
    } finally {
      if (turno === secuencia) document.querySelector(".idiomas").removeAttribute("aria-busy");
    }
  }

  enlaces.forEach(enlace => enlace.addEventListener("click", evento => {
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    cambiar(enlace.dataset.idioma);
  }));
  window.addEventListener("hashchange", actualizarEnlaces);
  window.addEventListener("popstate", evento => cambiar(normalizar(idiomaURL()) || evento.state?.hofrosaIdioma || "es", false));
  actualizarEnlaces(); marcar("es");
  try { history.replaceState({ ...history.state, hofrosaIdioma: inicial }, ""); } catch { /* El cambio de idioma no depende de History. */ }
  establecerCookie(inicial);
  if (inicial !== "es") cambiar(inicial, false);
})();
