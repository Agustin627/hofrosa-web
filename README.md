# Hotel Frontera — web

Sitio estático del hotel y restaurante en Ocotal. No requiere instalación de dependencias ni compilación.

## Vista local

Desde esta carpeta:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080`. Use la vista por HTTP para comprobar también Google Translate.

## Archivos

- `index.html`: estructura y contenido del sitio.
- `styles.css`: diseño clásico y adaptación a pantallas pequeñas.
- `app.js`: navegación, carga de datos y presentación del menú.
- `web-config.js`: opciones de presentación y conexión con el servidor de pedidos.
- `menu-datos.js`: copia local de la carta, precios, horarios y contacto.
- `idiomas.js`: selector español, inglés y chino simplificado mediante Google Translate.
- `assets/imagenes/`: fotografías y logo locales (`platos/` y `categorias/` para la carta).
- `editor/`: aplicación en Python para modificar el menú.

## Publicación

La web está publicada gratis en GitHub Pages: https://agustin627.github.io/hofrosa-web/

Después de cambiar el menú con el editor, haga doble clic en `publicar.command` (o ejecute `./publicar.command`) para subir los cambios; se ven en 1 o 2 minutos.

## Editar el menú

```sh
python3 editor/editor_menu.py
```

Se abre en el navegador (`http://127.0.0.1:8090`) un editor para agregar, editar, ordenar y eliminar platos y categorías; cambiar precios, etiquetas, opciones, «agotado», secciones, horarios y contacto; y subir o quitar la foto de cada plato y de cada categoría. Guarda en `menu-datos.js` con una copia previa en `editor/respaldos/` y valida los datos antes de guardar. Funciona solo con Python 3.8+; Pillow (`editor/requirements.txt`) es opcional.

Toda foto subida se recorta al centro a 3:2 y 960 × 640 en WebP, así que todas tienen el mismo tamaño. Se guardan en `assets/imagenes/platos/` y `assets/imagenes/categorias/` con un nombre nuevo cada vez; las anteriores no se borran, por lo que «Descartar cambios» siempre vuelve a una foto que existe.

Una foto puede marcarse como «Foto de referencia» (no es del plato real): la web la etiqueta como tal. Al subir la foto real desde el editor, la marca desaparece.

Las rutas de `WEB.imagenes.platos` y `WEB.imagenes.categorias` en `web-config.js` siguen teniendo prioridad sobre las fotos del menú.

Para usar el servidor de pedidos, configure `window.WEB.servidor` en `web-config.js`. Si la respuesta falla, tarda demasiado o no tiene una estructura válida, se usa `menu-datos.js`. El servidor debe permitir solicitudes desde el origen de esta web mediante CORS.

Todo el contenido se mantiene en español. El selector carga Google Translate al elegir otro idioma; Google también traduce los cambios de pestaña de la carta. La preferencia se conserva y puede compartirse con `?lang=en` o `?lang=zh`; `?lang=es` restaura el original. No hay diccionarios de traducción manuales ni claves de API en la web. Google Translate y las fuentes tipográficas necesitan conexión. Las fotografías y el logo se sirven desde el proyecto.

## Organización de la carta

Cada momento muestra secciones desplegables cerradas inicialmente, con sus categorías y el número real de opciones. Se pueden abrir varias para comparar o usar «Ver menú completo». Al abrir una sección aparecen todos sus platos, sin otro nivel de desplegables. La apertura se recuerda al alternar momentos durante la visita.

El diseño aplica la evidencia sobre la complejidad de elección y el efecto de las categorías: [Chernev et al., 2015](https://doi.org/10.1016/j.jcps.2014.08.002) y [Mogilner et al., 2008](https://doi.org/10.1086/588698). Los acordeones son una decisión de interfaz basada en esos principios; estos estudios no prueban que este diseño concreto reduzca el tiempo de pedido. La sobrecarga depende del contexto y no existe un límite universal de platos que deba imponerse a la carta: [Scheibehenne et al., 2010](https://doi.org/10.1086/651235).
