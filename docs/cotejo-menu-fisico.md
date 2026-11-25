# Cotejo de la carta física y digital

Restaurante Las Margaritas · Hotel Frontera, Ocotal.

## Alcance y resultado

Se contrastó la carta digital con las fotografías de la carta física aportadas por el usuario y se resolvieron las ambigüedades mediante sus confirmaciones. Las fotografías son la referencia de los nombres, precios e ingredientes legibles; las confirmaciones del usuario precisan las bebidas del desayuno y los acompañamientos de la pasta.

El catálogo resultante tiene **96 artículos**. Los precios de los 96 artículos conservados mantienen sus importes anteriores, incluidas las presentaciones ya configuradas. La comparación de datos antes y después no encontró cambios de precio, opciones ni presentaciones en los artículos retenidos. No se aplicó una conversión de moneda ni un redondeo para modificar los importes.

## Desayunos y extras

Los nueve desayunos y siete extras coinciden en precio con la fotografía:

| Desayuno | Precio |
|---|---:|
| Plato de frutas | 147 |
| Omelette Frontera | 152 |
| Segovia | 144 |
| Criollo | 165 |
| Rancheros | 147 |
| Continental | 125 |
| Especial de panqueques | 127 |
| Waffle | 147 |
| Quesadillas de queso y pollo | 165 |

| Extra | Precio |
|---|---:|
| Waffle | 59 |
| Tostadas | 40 |
| Un panqueque | 59 |
| Gallo pinto | 59 |
| Dos huevos a su gusto | 56 |
| Chorizo criollo | 73 |
| Salsa ranchera | 40 |

El usuario confirmó que el desayuno incluye **una bebida a elegir entre jugo de naranja, café y té**, y que Rancheros también permite elegir café. El plato de frutas permanece sin bebida incluida. Así se resuelve la redacción ambigua del impreso sin deducir que se sirven varias bebidas a la vez.

La fotografía no especifica té helado. Se retiró el artículo adicional de té helado que una migración había creado a partir del precio del té, y el desayuno utiliza el té ya existente. La migración también se corrigió para que no vuelva a generar ese artículo.

Se conservaron los ingredientes legibles, incluida la miel opcional del plato de frutas. No se asignaron cantidades no indicadas para las tostadas extra ni para las porciones de otros complementos.

## Ajustes del catálogo

- **Cerdo:** se retiró la entrada duplicada de costilla. Permanece “Chuleta o costilla de cerdo ahumada”, con las opciones Chuleta y Costilla ya configuradas y su precio de 440.
- **Pasta con camarones:** el usuario confirmó que no incluye ensalada, arroz ni papas. La excepción queda explícita tanto en el plato como en las notas de acompañamientos.
- **Nombres y ubicación:** se usa “Té rosa de Jamaica” y “Corvina”, sin añadir “filete”. La Michelada queda en Cócteles, conservando su precio y opciones.
- **Identidad:** Hotel Frontera y Restaurante Las Margaritas. El lema oficial confirmado por el usuario es “¡Su límite para descansar!”, indicación que prevalece sobre la lectura de la fotografía.
- **Descripciones:** se simplificaron detalles de ingredientes o preparación que no estaban confirmados por las fotografías. Esto evita afirmar recetas sin respaldo; no implica que las descripciones anteriores fueran falsas. Las variantes y presentaciones ya configuradas permanecen sin cambios.

## Precios e impuestos en la carta

Los precios se muestran como números enteros, sin símbolo monetario ni centavos en cada artículo, con la moneda indicada de forma general. El aviso **“No incluyen IVA ni propina”** aparece destacado bajo el título de la carta y separado del horario, sin porcentaje, conforme a la indicación del usuario. La tasa de impuestos se mantiene en la configuración para los cálculos; retirar el porcentaje del aviso no cambia ese valor.

## Fuente y sincronización

La corrección se guardó con el editor en la fuente del servidor de pedidos y se regeneraron las copias para el menú QR y la web. La fuente y ambas copias comparten la misma versión y contienen las mismas categorías, artículos, precios, opciones y presentaciones. La plantilla inicial también incorpora las correcciones; mantiene su propia versión inicial.

Los archivos principales son `servidor-pedidos/datos/menu.json` (fuente), `menu/js/datos.js` (QR), `menu-datos.js` (web) y `servidor-pedidos/menu-inicial.json` (plantilla). El servidor y el menú QR están en el proyecto hermano `../menu-digital-hofrosa/`. Se conservaron respaldos antes de aplicar la corrección. Las futuras modificaciones se mantienen desde el editor de Python, sin editar las copias públicas por separado.
