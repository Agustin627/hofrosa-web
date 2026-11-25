# Investigación para la carta de Las Margaritas

Restaurante Las Margaritas · Hotel Frontera, Ocotal, Nicaragua. Consulta de fuentes: 24 de noviembre de 2026.

## Qué se busca mejorar

La carta debe ayudar a encontrar, entender y comparar platos, manteniendo la información editable desde la aplicación de Python. El diseño presenta precios como `150` o `190`, categorías reconocibles y detalles cuando hacen falta. La evidencia orienta estas decisiones; no demuestra que esta interfaz concreta aumente las ventas.

## 1. Presentación de precios

**Fuente primaria:** Yang, S. S., Kimes, S. E. y Sessarego, M. M. (2009), *Menu Price Presentation Influences on Consumer Purchase Behavior in Restaurants*, International Journal of Hospitality Management, 28(1), 157–160. [Artículo en Cornell](https://ecommons.cornell.edu/entities/publication/87c48754-8c82-49c1-911c-f74da225c6e5), [DOI](https://doi.org/10.1016/j.ijhm.2008.06.012). El [informe de Cornell sobre el experimento](https://core.ac.uk/download/pdf/145016154.pdf) permite revisar los formatos y las limitaciones.

El experimento comparó precios con símbolo y centavos, números sin referencia monetaria y precios escritos en palabras durante el almuerzo de un restaurante de Estados Unidos. El formato global no fue un predictor significativo del gasto; un contraste ajustado mostró más gasto con números sin referencia a dólares que con los formatos que sí la incluían. Los propios autores señalan que factores operativos pesaron más que la tipografía.

**Límite:** fue un contexto específico, con dólares y carta física. Cambiaron varios elementos del formato a la vez; no permite aislar el efecto de quitar centavos o el símbolo. No demuestra un aumento universal ni el mismo resultado en un menú digital nicaragüense.

**Aplicación:** mostrar números enteros sin repetir `C$` ni `.00` en cada plato, con una leyenda general de moneda e IVA. Mantener el precio fácil de localizar. La aplicación de Python permite editar los importes; los precios enteros son una regla de edición, no un permiso para redondear valores fraccionarios de forma silenciosa.

## 2. Explicar el sabor con información verdadera

**Fuente primaria:** Turnwald, B. P. et al. (2019), *Increasing Vegetable Intake by Emphasizing Tasty and Enjoyable Attributes: A Randomized Controlled Multisite Intervention for Taste-Focused Labeling*, Psychological Science, 30(11), 1603–1615. [Texto completo](https://pmc.ncbi.nlm.nih.gov/articles/PMC6843749/), [DOI](https://doi.org/10.1177/0956797619872191).

Una intervención preregistrada en cinco comedores universitarios estadounidenses, con 137.842 decisiones, encontró mayor selección de verduras con etiquetas centradas en sabor que con etiquetas básicas o de salud. Los efectos fueron mayores donde las recetas también resultaban más sabrosas; las etiquetas de sabor superaron palabras simplemente positivas o elegantes.

**Límite:** se midió selección y consumo de verduras en comedores, no facturación de una carta completa. No autoriza trasladar sus porcentajes a Las Margaritas.

**Aplicación:** conservar a la vista los ingredientes y descripciones disponibles, y permitir editarlos en Python. Describir la preparación y el sabor con precisión: “con ajo y limón”, por ejemplo, solo cuando la receta realmente los lleva. No inventar ingredientes, procedencias ni popularidad. Las presentaciones y sus precios permanecen visibles; solo las opciones adicionales de preparación se consultan en un desplegable para mantener legible cada plato.

## 3. Reducir la dificultad de comparar

**Fuente de síntesis:** Chernev, A., Böckenholt, U. y Goodman, J. (2015), *Choice Overload: A Conceptual Review and Meta-analysis*, Journal of Consumer Psychology, 25(2), 333–358. [Publicación y corrección enlazada por el editor](https://doi.org/10.1016/j.jcps.2014.08.002).

El meta-análisis de 99 observaciones y 7.202 participantes identifica cuatro moderadores: complejidad del conjunto, dificultad de la decisión, incertidumbre sobre preferencias y objetivo de minimizar esfuerzo. La cantidad de alternativas no explica por sí sola la sobrecarga.

**Aplicación inferida:** mantener los momentos de consumo, ofrecer categorías y búsqueda, y mostrar información adicional progresivamente. La búsqueda global permite encontrar un plato aunque esté en otro momento; su contexto se muestra para explicar dónde pertenece. El selector “Todas las categorías” y los filtros se pueden desactivar para recuperar la carta. Estas funciones buscan disminuir el esfuerzo de navegación; el meta-análisis no evaluó estos controles concretos.

## 4. No imponer un número mágico de platos

**Fuente de síntesis:** Scheibehenne, B., Greifeneder, R. y Todd, P. M. (2010), *Can There Ever Be Too Many Options? A Meta-Analytic Review of Choice Overload*, Journal of Consumer Research, 37(3), 409–425. [DOI y publicación](https://doi.org/10.1086/651235).

En 50 experimentos, con 5.036 participantes, el efecto medio de la sobrecarga fue prácticamente nulo, con una variación considerable entre estudios. Esto y el análisis posterior de Chernev aconsejan tratar la sobrecarga como un efecto dependiente del contexto.

**Aplicación:** organizar el catálogo sin borrar platos para cumplir una supuesta regla de siete opciones. Mostrar inicialmente las primeras categorías abiertas ofrece contenido inmediatamente; las restantes secciones se pueden desplegar. Un bloque breve de recomendaciones, visible sin desplegarlo, facilita explorar los platos que el restaurante ya ha marcado. La elección de acordeones y las categorías iniciales abiertas es una decisión de interfaz, no una conclusión experimental de estos artículos.

## 5. Fotografías y nombres comprensibles

**Fuente primaria:** Hou, Y., Yang, W. y Sun, Y. (2017), *Do Pictures Help? The Effects of Pictures and Food Names on Menu Evaluations*, International Journal of Hospitality Management, 60, 94–103. [Registro institucional y manuscrito](https://durham-repository.worktribe.com/output/1395393/do-pictures-help-the-effects-of-pictures-and-food-names-on-menu-evaluations), [DOI](https://doi.org/10.1016/j.ijhm.2016.10.008).

El estudio encontró efectos favorables de fotografías junto a nombres descriptivos comunes sobre evaluaciones e intenciones. El resultado con nombres ambiguos dependía del estilo de procesamiento del participante.

**Límite:** intención de compra y disposición a pagar no equivalen a ventas observadas. No demuestra que cada plato deba tener fotografía.

**Aplicación:** las fotos siguen siendo opcionales y editables. Usar nombres claros y preservar la distinción existente entre una fotografía real y una de referencia. La búsqueda no depende de que haya una imagen.

## Guías de diseño digital

Estas referencias complementan la investigación de compra. Se distingue entre estudio de interacción, recomendaciones profesionales y criterios de accesibilidad; no se presentan como pruebas de incremento de ventas.

**Estudio académico de interacción.** Lessel, P., Böhmer, M., Kröner, A. y Krüger, A. (NordiCHI 2012), *User Requirements and Design Guidelines for Digital Restaurant Menus*. Su encuesta, entrevistas y evaluación de un prototipo de tablet derivan recomendaciones para mantener la información esencial, navegar rápidamente entre categorías y acceder a los detalles de los platos. También aconsejan no dar protagonismo excesivo a funciones ajenas a elegir la comida. Se desarrolló en Alemania y su evaluación de prototipo empleó un público concreto; no prueba eficacia comercial ni valida directamente una carta QR en móviles de Nicaragua. [Artículo de los autores](https://umtl.cs.uni-saarland.de/paper_preprints/paper_user_requirements_and_design_guidelines.pdf).

**Práctica profesional de proveedores.** La guía de [Toast, “How to Make a Digital Menu for Your Restaurant in 2026”](https://pos.toasttab.com/blog/on-the-line/digital-menu) recomienda categorías reconocibles, contraste, espacio, descripciones exactas, precios y opciones claros, una fuente central para mantener el menú y pruebas en los dispositivos de uso. La guía de [AlaMenu, “Restaurant menu design: a practical guide for printed and QR menus”](https://www.alamenu.io/blog/restaurant-menu-design) aconseja un diseño móvil legible, categorías y búsqueda, fotos fieles y moneda indicada una sola vez. Son consejos de empresas que venden estas soluciones, no experimentos causales. No se adoptan sus cantidades orientativas de categorías o platos como leyes científicas.

**Accesibilidad.** La explicación del [criterio WCAG 2.2 2.5.8 del W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) define para nivel AA objetivos de puntero de al menos 24 × 24 píxeles CSS, con alternativas de espaciado y excepciones. El criterio mejorado usa 44 × 44. Los controles principales pueden aspirar a este tamaño mayor para facilitar su uso táctil. Esto es una pauta de accesibilidad y facilidad de activación; no una afirmación sobre gasto.

## Decisiones de interacción y datos

Estas son decisiones de producto informadas por los principios anteriores, no efectos demostrados por esos estudios:

- Pestañas por momento, selector de categoría y búsqueda global por platos, ingredientes, opciones y categoría, tolerante a tildes.
- Filtros con estado visible: “Recomendados” usa las etiquetas existentes `casa` o `popular`; “Disponibles” excluye platos marcados como agotados. La interfaz no convierte esas etiquetas en cifras de ventas ni reseñas.
- Coincidencias de otros momentos acompañadas de su contexto. Una búsqueda vacía permite volver a explorar por momento.
- Ingredientes, presentaciones y sus precios visibles; opciones de preparación desplegables; categorías iniciales abiertas y posibilidad de ampliar el resto de la carta. Los recomendados breves aparecen directamente, sin acordeón.
- Precios enteros sin símbolo ni centavos en cada plato y una leyenda general de moneda. Se conserva el aviso “No incluyen IVA (15 %) ni propina”; la refactorización no cambia la política de impuestos.
- Identidad editable: `config.hotel.nombre` para Hotel Frontera y `config.hotel.restaurante` para Restaurante Las Margaritas.
- Una misma fuente de contenido: menú de la API cuando está disponible y `menu-datos.js` como respaldo. El editor de Python mantiene nombres, precios, descripciones, categorías, momentos, etiquetas, disponibilidad, opciones y fotos.

## Cómo comprobar el resultado

Primero verificar que una persona puede encontrar un plato por nombre o ingrediente, reconocer su categoría y momento, consultar las presentaciones y entender el precio. Comprobar también el uso en móvil y con teclado, los estados sin resultados y que los cambios guardados en Python se reflejan en la carta.

Para evaluar efectos comerciales haría falta una comparación local con pedidos reales, periodos comparables, precios y disponibilidad controlados, y una medida definida de antemano. Esta refactorización no genera estadísticas ni afirma haber medido un incremento de ventas. No se usa el supuesto “triángulo dorado” como regla científica del diseño.
