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
- `precios/`: editor de precios de la web (detrás de Cloudflare Access).
- `worker/`, `wrangler.jsonc`, `_headers`, `.assetsignore`: la web en Cloudflare (API de precios, cabeceras de seguridad, archivos que no se publican).

## Fotografías del hotel

Las fotografías nuevas están en `assets/imagenes/espacios/`, optimizadas en WebP a partir de los originales del álbum facilitado por el propietario. La portada alterna vistas de día y de noche. «Más fotos del hotel» muestra cuatro vistas complementarias: parqueo, sala de descanso, recepción y vista desde la terraza superior. La selección evita repetir fotografías de la portada y las secciones principales, así como tomas casi idénticas del mismo ángulo.

El pasillo con mesas y sillas de metal junto a la piscina forma parte del comedor; su fotografía está en la sección del restaurante. La terraza del bar está en la planta superior.

En habitaciones se muestran las fotos de la doble y la triple. La imagen antigua asignada a «Sencilla» era otra toma de la misma habitación doble; se omite hasta disponer de una fotografía confirmada de la sencilla.

El auditorio **Segovia** es el de sillas de madera; **Aurora**, el de sillas blancas de plástico. Ambos tienen mesas en herradura. `docs/fotos-espacios.json` registra las fuentes, dimensiones y correspondencias de las fotografías, sin incluir enlaces privados al álbum.

## Publicación

La web va a estar en **https://hotelfronteraocotal.com** con Cloudflare (Workers con archivos estáticos). La copia en GitHub Pages (https://agustin627.github.io/hofrosa-web/) sigue funcionando como respaldo, sin precios en vivo ni editor. Para cambiar de dominio, cambie el enlace `canonical` de `index.html`: `publicar.command` toma la dirección de ahí.

Después de cambiar el menú (con el editor, desde el panel del servidor de pedidos o en `/precios/`), haga doble clic en `publicar.command` (o ejecute `./publicar.command`). Lo hace `editor/publicar.py`:

1. Trae los precios guardados en el editor de la web (`/api/precios-web`) y lo publicado en GitHub desde otro lugar (otra computadora, Codex).
2. Pasa esos precios al menú único (servidor de pedidos / menú QR). Si el mismo precio cambió en los dos lados, gana el cambio más reciente y lo avisa en pantalla.
3. Regenera `menu-datos.js` desde el menú único, guarda todo en un commit y lo sube a GitHub. Cloudflare publica la web sola en 1 o 2 minutos.

Nunca fuerza la subida: si GitHub y esta computadora cambiaron el mismo archivo (que no sea el menú), se detiene, no sube nada y no se pierde nada. Si la web no responde, publica igual: los precios siguen guardados en la web y se traen la próxima vez.

Qué se publica: Cloudflare sube solo los archivos de la web; `.assetsignore` deja afuera el editor, los documentos, el Worker y los archivos con aspecto de secreto. En GitHub Pages se ve todo el repositorio (que es público). `editor/ajustes.json` y `editor/respaldos/` nunca se suben (`.gitignore`).

## Cambiar precios desde la web

Dirección: https://hotelfronteraocotal.com/precios/ (no está enlazada desde la web pública).

- **Cómo se entra:** Cloudflare Access pide el correo y manda un código de 6 dígitos. Solo pasan los correos autorizados; a los demás no les llega ni la página. No hay contraseñas ni tokens que guardar o que se puedan robar.
- **Qué cambia:** solo los números de precio. Antes de guardar se revisa la lista y se confirman los precios que cambian más de 50 % o quedan en cero. Si otra persona guardó entretanto, se recarga sin pisar su cambio.
- **Dónde queda:** en Cloudflare (un Durable Object), con registro de quién, cuándo y qué. La web pública muestra el precio nuevo en menos de un minuto (`/api/menu`).
- **Menú QR:** recibe los precios al abrir `publicar.command` en la computadora del hotel. Mientras tanto, el editor avisa «En el menú QR sigue … hasta publicar».
- **Seguridad** (OWASP Top 10:2025, OWASP Cheat Sheets y documentación de Cloudflare):
  - Access protege `/precios` y `/precios/*` antes de que la petición llegue a la web.
  - El Worker vuelve a comprobar cada petición: firma RS256 del JWT de Access con las claves públicas del equipo, emisor, audiencia (AUD), vigencia y que el correo esté en `CORREOS_ADMIN`. Si falta algo de la configuración, no entra nadie.
  - Guardar exige JSON del mismo origen (`Origin`, `Sec-Fetch-Site`): un sitio ajeno no puede cambiar precios aunque la sesión esté abierta (CSRF).
  - Solo se aceptan precios enteros de 0 a 1 000 000 de productos que existen. La versión del Durable Object evita que dos personas se pisen.
  - Cabeceras de seguridad reales (`_headers`): HSTS, CSP, `frame-ancestors`, `nosniff`, `Permissions-Policy`. El editor además usa Trusted Types y no guarda nada en el navegador.
  - Sin direcciones `*.workers.dev` ni de vista previa (no pasarían por Access).

### Poner la web en Cloudflare (una sola vez)

Necesita la cuenta de GitHub y acceso al lugar donde se compró el dominio. Active la verificación en dos pasos en Cloudflare y en GitHub: esas cuentas son las llaves de la web. Los nombres de los botones pueden variar un poco según el idioma del panel.

Antes de empezar, abra `publicar.command` una vez: sube a GitHub los archivos que Cloudflare necesita (`wrangler.jsonc`, `worker/`, `_headers`).

Hoy `hotelfronteraocotal.com` muestra otra página («Hotel Frontera en Ocotal, Nicaragua»); al terminar el paso 3, la reemplaza esta web. Mientras tanto la web nueva se ve en GitHub Pages, y `publicar.command` lo recuerda al final.

1. **Cuenta y dominio.** Cree una cuenta gratis en https://dash.cloudflare.com y elija *Agregar un dominio* → `hotelfronteraocotal.com` → plan *Free*. Cloudflare copia los registros DNS que ya tiene el dominio: revíselos y, si el hotel tiene correo con ese dominio (registros MX), déjelos. Cloudflare le dará dos *nameservers*: póngalos en el sitio donde se compró el dominio y espere a que el dominio figure como *Activo*.
2. **Publicar la web.** *Workers y Pages* → *Crear* → *Importar un repositorio* → conecte GitHub (solo `hofrosa-web`) → nombre del proyecto **`hofrosa-web`** (igual que en `wrangler.jsonc`) → comando de compilación vacío, comando de implementación `npx wrangler deploy` → *Implementar*. Desde ahí, cada `publicar.command` actualiza la web sola.
3. **Dominio.** En el Worker `hofrosa-web` → *Configuración* → *Dominios y rutas* → *Agregar* → *Dominio personalizado* → `hotelfronteraocotal.com`. Si avisa que ya existe un registro DNS con ese nombre (el de la web vieja), bórrelo en *DNS* y vuelva a intentar. Para `www`: *Reglas* → *Reglas de redirección* → plantilla *Redirigir de WWW a raíz*.
4. **Zero Trust.** En el menú, *Zero Trust*: elija un nombre de equipo (por ejemplo `hotelfrontera`) y el plan *Free*. Pide una tarjeta, pero no cobra.
5. **Código al correo.** *Configuración* → *Autenticación* → *Métodos de inicio de sesión* → *Agregar nuevo* → *One-time PIN*.
6. **Proteger el editor.** *Access* → *Aplicaciones* → *Agregar una aplicación* → *Autoalojada* (Self-hosted). Nombre: «Precios de la carta». Duración de la sesión: 8 horas. Agregue **dos** destinos: `hotelfronteraocotal.com` con ruta `precios` y `hotelfronteraocotal.com` con ruta `precios/*`. Política: *Permitir*, *Incluir* → *Correos* → su correo (y el de quien más pueda cambiar precios). Método de inicio: *One-time PIN*. Guarde y copie la **etiqueta de audiencia (AUD)** de la aplicación.
7. **Decirle al Worker quién entra.** En el Worker `hofrosa-web` → *Configuración* → *Variables y secretos* → agregue tres de tipo **Secreto**:
   - `ACCESS_EQUIPO`: el nombre de equipo del paso 4 (solo el nombre, sin `.cloudflareaccess.com`).
   - `ACCESS_AUD`: la etiqueta AUD del paso 6.
   - `CORREOS_ADMIN`: los mismos correos de la política, separados por comas.

   Use el tipo *Secreto* (así los correos no quedan a la vista en el panel) y guarde con *Implementar*. Publicar desde GitHub no los borra.
8. **Probar.** Abra https://hotelfronteraocotal.com/precios/ → escriba su correo → copie el código → debe ver «Conectado como …». Cambie un precio, guárdelo y mire la carta en la web: el precio nuevo aparece en menos de un minuto. En una ventana privada, con otro correo, no debe llegar ningún código.

Para agregar o quitar a alguien: cambie la política de Access **y** `CORREOS_ADMIN`. Para cerrar sesiones abiertas: *Zero Trust* → *Usuarios* → revocar. Los ingresos quedan en *Zero Trust* → *Registros* → *Access*.

## Un solo menú para la web y el menú QR

La carta es una sola: `datos/menu.json` del servidor de pedidos (`../menu-digital-hofrosa/servidor-pedidos`), el mismo que usan el menú QR de las mesas y su panel de administración. `menu-datos.js` es solo la copia pública que lee esta web (sin mesas, claves ni traducciones) y se regenera sola:

- Al guardar en el editor de esta web: si el servidor de pedidos está encendido, el cambio entra por su API (como el panel, con clave, versión y registro) y el menú QR cambia al instante; si está apagado, se escribe su archivo con respaldo y lo carga al arrancar. En los dos casos se regenera `menu-datos.js`.
- Al cambiar algo desde el panel del servidor: `publicar.command` sincroniza la copia antes de publicar (o `python3 editor/editor_menu.py --sincronizar`).
- Al cambiar precios en la web (`/precios/`): el cambio queda en Cloudflare y la web lo muestra al momento; `publicar.command` lo pasa al menú único (por la API si el servidor está encendido, con su registro) antes de regenerar la copia. Así la copia nunca vuelve a los precios viejos.
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
