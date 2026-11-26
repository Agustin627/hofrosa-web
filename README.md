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
- `editor/`: aplicación en Python para modificar el menú (`editor_menu.py`) y publicar (`publicar.py`).
- `precios/`: editor de precios de la web (con token de GitHub).

## Fotografías del hotel

Las fotografías nuevas están en `assets/imagenes/espacios/`, optimizadas en WebP a partir de los originales del álbum facilitado por el propietario. La portada alterna vistas de día y de noche. «Más fotos del hotel» muestra cuatro vistas complementarias: parqueo, sala de descanso, recepción y vista desde la terraza superior. La selección evita repetir fotografías de la portada y las secciones principales, así como tomas casi idénticas del mismo ángulo.

El pasillo con mesas y sillas de metal junto a la piscina forma parte del comedor; su fotografía está en la sección del restaurante. La terraza del bar está en la planta superior.

En habitaciones se muestran las fotos de la doble y la triple. La imagen antigua asignada a «Sencilla» era otra toma de la misma habitación doble; se omite hasta disponer de una fotografía confirmada de la sencilla.

El auditorio **Segovia** es el de sillas de madera; **Aurora**, el de sillas blancas de plástico. Ambos tienen mesas en herradura. `docs/fotos-espacios.json` registra las fuentes, dimensiones y correspondencias de las fotografías, sin incluir enlaces privados al álbum.

## Publicación

La web está publicada gratis en GitHub Pages: https://agustin627.github.io/hofrosa-web/

Después de cambiar el menú (con el editor o desde el panel del servidor de pedidos), haga doble clic en `publicar.command` (o ejecute `./publicar.command`). Lo hace `editor/publicar.py`:

1. Trae de GitHub lo publicado desde otro lugar: precios cambiados en la web (`precios/`) o cambios hechos en otra computadora.
2. Pasa esos precios al menú único (servidor de pedidos / menú QR). Si el mismo precio cambió en los dos lados, gana el cambio más reciente y lo avisa en pantalla.
3. Regenera `menu-datos.js` desde el menú único, guarda todo en un commit y lo sube. La web se actualiza sola en 1 o 2 minutos.

Nunca fuerza la subida: si GitHub y esta computadora cambiaron el mismo archivo (que no sea el menú), se detiene, no sube nada y no se pierde nada.

GitHub Pages publica la rama `main` tal como está. Los ajustes del editor (`editor/ajustes.json`) y los respaldos (`editor/respaldos/`) no se suben, porque están en `.gitignore`, igual que archivos con aspecto de secreto (`*.token`, `*.key`, `.env`…). Si algún día se usa otro hosting, `python3 editor/preparar_sitio.py` prepara en `dist/` solo los archivos públicos, sin el editor.

## Cambiar precios desde la web

Dirección: https://agustin627.github.io/hofrosa-web/precios/ (no está enlazada desde la web pública).

- **Quién puede:** solo quien tenga un *token fino* de GitHub (empieza con `github_pat_`) con permiso **Contents: Read and write** sobre **este repositorio solamente**. La página tiene un enlace que crea el token con esos permisos ya elegidos (vence en 90 días); en *Repository access* hay que marcar *Only select repositories → hofrosa-web*. Los tokens clásicos (`ghp_`) se rechazan porque abren todos los repositorios.
- **Qué cambia:** solo los números de precio de `menu-datos.js`. Antes de publicar, la página comprueba que nada más cambió, pide confirmar los precios que cambian más de 50 % o quedan en cero, y publica sobre la versión exacta que leyó: si otra persona publicó entretanto, recarga y conserva lo que no choca.
- **Dónde queda:** cada publicación es un commit con la lista de cambios (historial en la misma página y en GitHub). Para deshacer, se vuelve a poner el precio anterior o se revierte el commit en GitHub.
- **Menú QR:** recibe los precios nuevos al abrir `publicar.command` en esta computadora (paso 2 de la publicación).
- **Seguridad** (basada en OWASP Top 10:2025 y sus hojas de referencia):
  - Sin servidor propio ni claves en el código: GitHub decide quién escribe.
  - Política de seguridad estricta: solo archivos propios y `api.github.com`, Trusted Types (nada de HTML armado con texto), sin formularios hacia afuera, sin referer, sin funcionar dentro de un marco ni abierta por otra ventana.
  - El token vive solo en memoria. Si se pide recordarlo, se guarda cifrado (AES-GCM de 256 bits) con una clave derivada de una frase de 12+ caracteres (PBKDF2-SHA256, 600 000 iteraciones). Tras un error se espera cada vez más; a los 10 errores se borra.
  - Se bloquea sola a los 15 minutos sin uso o si queda 5 minutos en segundo plano.
  - Se comprueba el SHA del archivo que entrega GitHub (detecta un menú alterado o incompleto) y que antes de los datos solo haya comentarios.
- **Si se pierde o se filtra el token:** bórrelo en GitHub (*Settings → Developer settings → Personal access tokens*) y cree otro. En otro dispositivo, use «Olvidar este dispositivo».
- **Recomendado:** activar la verificación en dos pasos de la cuenta de GitHub. Todas las webs de `agustin627.github.io` comparten el mismo origen; con un dominio propio la web queda aislada y se podrían usar cabeceras de seguridad de verdad.

## Un solo menú para la web y el menú QR

La carta es una sola: `datos/menu.json` del servidor de pedidos (`../menu-digital-hofrosa/servidor-pedidos`), el mismo que usan el menú QR de las mesas y su panel de administración. `menu-datos.js` es solo la copia pública que lee esta web (sin mesas, claves ni traducciones) y se regenera sola:

- Al guardar en el editor de esta web: si el servidor de pedidos está encendido, el cambio entra por su API (como el panel, con clave, versión y registro) y el menú QR cambia al instante; si está apagado, se escribe su archivo con respaldo y lo carga al arrancar. En los dos casos se regenera `menu-datos.js`.
- Al cambiar algo desde el panel del servidor: `publicar.command` sincroniza la copia antes de publicar (o `python3 editor/editor_menu.py --sincronizar`).
- Al cambiar precios en la web (`precios/`): el cambio queda en GitHub y `publicar.command` lo pasa al menú único (por la API si el servidor está encendido, con su registro) antes de regenerar la copia. Así la copia nunca vuelve a los precios viejos.
- Las fotos se guardan en `menu/fotos/` del menú QR y se copian a `fotos/` de esta web, con la misma ruta `fotos/…`. Solo se copian nombres simples de esa carpeta: nunca una ruta con `..`.

Si el servidor está en otra carpeta o puerto, cree `editor/ajustes.json` con `{"servidorPedidos": "/ruta/a/servidor-pedidos", "puertoSeguro": 8443}`. Sin servidor, el editor edita solo la copia de la web (`--solo-web`).

## Editar el menú

```sh
python3 editor/editor_menu.py
```

Se abre en el navegador (`http://127.0.0.1:8090`) un editor para agregar, editar, ordenar y eliminar platos y categorías; cambiar precios, etiquetas, opciones, «agotado», secciones, horarios y contacto; y subir o quitar la foto de cada plato y de cada categoría. Valida los datos con las mismas reglas del servidor de pedidos antes de guardar. Funciona solo con Python 3.8+; Pillow (`editor/requirements.txt`) es opcional.

Toda foto subida se recorta al centro a 3:2 y 960 × 640 en WebP, así que todas tienen el mismo tamaño. Cada foto recibe un nombre nuevo; las anteriores no se borran, por lo que «Descartar cambios» siempre vuelve a una foto que existe.

Una foto puede marcarse como «Foto de referencia» (no es del plato real): la web la etiqueta como tal. Al subir la foto real desde el editor, la marca desaparece.

Las rutas de `WEB.imagenes.platos` y `WEB.imagenes.categorias` en `web-config.js` siguen teniendo prioridad sobre las fotos del menú.

Para usar el servidor de pedidos, configure `window.WEB.servidor` en `web-config.js`. Si la respuesta falla, tarda demasiado o no tiene una estructura válida, se usa `menu-datos.js`. El servidor debe permitir solicitudes desde el origen de esta web mediante CORS.

Todo el contenido se mantiene en español. El selector carga Google Translate al elegir otro idioma; Google también traduce los cambios de pestaña de la carta. La preferencia se conserva y puede compartirse con `?lang=en` o `?lang=zh`; `?lang=es` restaura el original. No hay diccionarios de traducción manuales ni claves de API en la web. Google Translate y las fuentes tipográficas necesitan conexión. Las fotografías y el logo se sirven desde el proyecto.

## Organización de la carta

La identidad es Hotel Frontera y Restaurante Las Margaritas. Los nombres se pueden cambiar desde el editor de Python mediante `config.hotel.nombre` y `config.hotel.restaurante`, junto con el resto de los datos del menú.

La carta conserva las pestañas por momento y añade una búsqueda global por nombre del plato, ingredientes, opciones y categoría, sin distinguir tildes. Al buscar también aparecen coincidencias de otros momentos, con su contexto visible. El selector «Todas las categorías» y los filtros «Recomendados» (etiquetas `casa` o `popular`) y «Disponibles» permiten acotar los resultados.

Cada momento presenta recomendaciones breves visibles sin desplegarlas y secciones desplegables: las categorías iniciales se abren, y las restantes secciones se pueden abrir para comparar o mediante «Ver menú completo». Los ingredientes, las presentaciones y sus precios permanecen visibles; las opciones de preparación de un plato se consultan en su desplegable. La apertura de las secciones se recuerda durante la visita.

Los precios se presentan como `150` o `190`, sin símbolo monetario ni centavos en cada plato; una leyenda general informa la moneda y conserva el aviso «No incluyen IVA ni propina». Los importes enteros siguen siendo editables desde Python. Platos, precios, categorías, momentos, etiquetas, disponibilidad, opciones y fotos proceden del menú de la API o de `menu-datos.js` como respaldo.

Las decisiones combinan evidencia sobre presentación de precios y dificultad de elección con criterios de interacción. Los estudios no prueban que esta interfaz concreta aumente las ventas ni establecen un límite universal de platos. La [investigación y sus límites](docs/investigacion-menu.md) distinguen los hallazgos científicos de las decisiones de diseño.

## Encuéntranos

La sección incluye un mapa de Google Maps y enlaces para abrir la ubicación o iniciar una ruta. La ubicación se cambia en «Identidad y contacto» del editor de Python (`config.hotel.ubicacion`); el mapa y sus enlaces se generan con ese valor y el nombre del hotel.
