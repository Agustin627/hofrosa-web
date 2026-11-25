/* =====================================================================
   AJUSTES DE LA WEB
   El contenido del menú (categorías, platos, precios, etiquetas, horarios,
   agotados, fotos, contacto) NO se escribe aquí: viene del servidor de
   pedidos (lo que se cambia en admin.html) o, si no responde, de la copia
   menu-datos.js. Aquí solo se ajusta cómo se muestra.
   ===================================================================== */
window.WEB = {
  // Dirección del servidor de pedidos, p. ej. "https://192.168.1.50:8443".
  // Vacío = usar solo la copia local menu-datos.js.
  servidor: "",
  esperaMs: 4000,                    // tiempo máximo para esperar al servidor
  idioma: "es",                     // contenido original; Google traduce la página al idioma elegido
  momentos: { desayuno: "Desayuno", almuerzo: "Almuerzo y cena", bar: "Bar" },
  etiquetas: { popular: "Recomendado", casa: "De la casa", tipico: "Típico nica", compartir: "Para compartir" },
  presentaciones: { botella: "Botella", media: "Media", trago: "Trago" },
  // Se filtran por el momento activo y se excluyen agotados. [] = desactivar.
  recomendaciones: { etiquetas: ["casa", "popular"], maximo: 3, porCategoria: 1 },
  // Los ids también funcionan con el menú en vivo, aunque todavía no incluya la etiqueta.
  compartir: { etiquetas: ["compartir"], ids: ["papas", "tostones"], maximo: 3 },
  // Platos de una categoría que empiezan igual («Hamburguesa Frontera / de res / de pollo»)
  // se muestran juntos: «Hamburguesa» y debajo «Frontera · Res · Pollo». activo: false = desactivar.
  agrupar: { activo: true, minimo: 2 },
  simboloPorPrecio: false,           // la moneda y el IVA se anuncian sobre la carta
  // Fotos reales: por id de plato/categoría, con rutas locales de esta web.
  // También se admiten p.foto y c.foto del servidor de pedidos si no hay una ruta aquí.
  imagenes: {
    platos: {
      // criollo: { src: "assets/imagenes/platos/criollo.webp", alt: "Desayuno criollo" },
    },
    categorias: {
      // carnes: { src: "assets/imagenes/platos/carnes.webp", alt: "Platos de carne" },
    },
  },
  mostrarDolares: false,             // muestra el equivalente en US$ con config.tipoCambio
  textos: {
    recomendados: "Recomendados",
    notaRecomendados: "Una selección de la carta.",
    compartir: "Para compartir",
    notaCompartir: "Para el centro de la mesa.",
    verCartaCompleta: "Ver menú completo",
    cerrarSecciones: "Cerrar todas las secciones",
    unaOpcion: "{n} opción",
    numeroOpciones: "{n} opciones",
    sinPlatos: "No hay platos en esta sección.",
    agotado: "Agotado",
    incluyeDesayuno: "Incluye una bebida a elegir: {lista}.",
    incluyeFuerte: "Acompañado de ensalada, arroz y papas.",
    sinIva: "Precios en {moneda}. No incluyen IVA ({iva}) ni propina.",
    horario: "Servimos de {desde} a {hasta}",
    sinMenu: "No se pudo cargar el menú. Llámenos al {tel}.",
    reservar: "Reservar: {tel}",
    horarioLinea: "{nombre}: {desde} a {hasta}",
    tel: "Tel.",
    cel: "Cel.",
    monedaLocal: "córdobas (C$)",
    fotoReferencia: "Foto de referencia",
    referenciaBreve: "Referencia",
    avisoFotos: "Fotos de referencia de platos similares. La presentación real puede variar.",
    creditosFotos: "Fuentes y licencias",
  },
};
