#!/usr/bin/env python3
"""
Editor del menú de la web del Hotel Frontera.

Abre en el navegador una pantalla para modificar la carta (platos, precios,
categorías, secciones, horarios y contacto). El menú es UNO solo: el
datos/menu.json del servidor de pedidos, el mismo del menú QR. Al guardar se
cambia ese menú (por la API del servidor si está encendido) y se regenera
../menu-datos.js, la copia que lee la web.

Uso:
    python3 editor/editor_menu.py                abre el editor en el navegador
    python3 editor/editor_menu.py --puerto 8090
    python3 editor/editor_menu.py --sin-navegador
    python3 editor/editor_menu.py --sincronizar  copia a la web los cambios hechos en el panel del servidor
    python3 editor/editor_menu.py --solo-web     edita solo la copia de la web

Funciona solo con Python 3.8 o superior. Si además está instalado Pillow
(python3 -m pip install -r editor/requirements.txt), el recorte de las fotos
lo hace Python; si no, lo hace el navegador con el mismo resultado.
El editor escucha únicamente en esta computadora (127.0.0.1).
"""
import argparse
import copy
import hashlib
import importlib.util
import shutil
import ssl
import urllib.error
import urllib.request
import io
import json
import os
import re
import secrets
import sys
import tempfile
import threading
import webbrowser
import warnings
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:
    Image = ImageOps = None
    UnidentifiedImageError = OSError

CARPETA_EDITOR = Path(__file__).resolve().parent
CARPETA_WEB = Path(os.environ.get("HOFROSA_WEB_ROOT", CARPETA_EDITOR.parent)).resolve()
ARCHIVO_MENU = CARPETA_WEB / "menu-datos.js"
CARPETA_RESPALDOS = CARPETA_WEB / "editor" / "respaldos"
PAGINA_EDITOR = CARPETA_EDITOR / "editor.html"
CARPETA_FOTOS = CARPETA_WEB / "assets" / "imagenes"
RUTA_FOTOS = "assets/imagenes/"
MAX_FOTO = 12 * 1024 * 1024
TAMANO_FOTO = (960, 640)
TIPOS_FOTO = {"platos", "categorias"}
MAX_RESPALDOS = 40
MAX_CUERPO = 5 * 1024 * 1024

VARIABLE = "window.MENU_RESPALDO"
CABECERA = (
    "/* Copia de respaldo del menú (mismo formato que servidor-pedidos/datos/menu.json).\n"
    "   La web la usa si no puede leer el menú en vivo del servidor.\n"
    "   Se puede editar con: python3 editor/editor_menu.py */\n"
)
ID_VALIDO = re.compile(r"[a-z0-9-]{1,40}")
HORA_VALIDA = re.compile(r"([01]\d|2[0-3]):[0-5]\d")
INCLUYE = {"", "desayuno", "fuerte"}


class ErrorMenu(Exception):
    """Un problema en los datos que el usuario debe corregir."""


# ---------------------------------------------------------------------------
# Fuente única del menú: el servidor de pedidos (menú QR)
# ---------------------------------------------------------------------------
# La web y el menú QR muestran el MISMO menú: el datos/menu.json del servidor de
# pedidos. Este editor lo modifica (por la API del servidor si está encendido,
# o en el archivo si está apagado) y luego regenera la copia de la web
# (menu-datos.js). Si no se encuentra el servidor, edita solo la copia de la web.
AJUSTES = CARPETA_EDITOR / "ajustes.json"   # opcional: {"servidorPedidos": "...", "puertoSeguro": 8443}
CONFIG_PUBLICA = ("zonaHoraria", "horario", "moneda", "tipoCambio", "iva", "idiomaBase", "hotel", "bebidasDesayuno")


def _ajustes():
    try:
        return json.loads(AJUSTES.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def carpeta_servidor():
    ruta = os.environ.get("HOFROSA_SERVIDOR") or _ajustes().get("servidorPedidos") \
        or CARPETA_WEB.parent / "menu-digital-hofrosa" / "servidor-pedidos"
    ruta = Path(ruta).expanduser().resolve()
    return ruta if (ruta / "datos" / "menu.json").is_file() and (ruta / "servidor.py").is_file() else None


SERVIDOR = None          # Path de servidor-pedidos o None
_modulo_servidor = None


def modulo_servidor():
    """El propio servidor.py: su validación garantiza que el menú QR acepte lo guardado."""
    global _modulo_servidor
    if _modulo_servidor is None:
        sys.path.insert(0, str(SERVIDOR))
        espec = importlib.util.spec_from_file_location("servidor_pedidos", SERVIDOR / "servidor.py")
        _modulo_servidor = importlib.util.module_from_spec(espec)
        espec.loader.exec_module(_modulo_servidor)
    return _modulo_servidor


def archivo_fuente():
    return SERVIDOR / "datos" / "menu.json"


def carpeta_fotos_servidor():
    return SERVIDOR.parent / "menu" / "fotos"


def _contexto_ssl():
    ca = SERVIDOR / "datos" / "certificados" / "ca.crt"
    return ssl.create_default_context(cafile=str(ca)) if ca.is_file() else None


def _url_servidor(ruta):
    return f"https://127.0.0.1:{int(_ajustes().get('puertoSeguro', 8443))}{ruta}"


def servidor_encendido():
    ctx = _contexto_ssl()
    if not ctx:
        return False
    try:
        with urllib.request.urlopen(_url_servidor("/api/estado"), timeout=1.5, context=ctx) as r:
            return r.status == 200
    except (OSError, urllib.error.URLError, ssl.SSLError):
        return False


def _clave_admin():
    try:
        return json.loads((SERVIDOR / "datos" / "config.json").read_text(encoding="utf-8"))["claveAdmin"]
    except (OSError, ValueError, KeyError) as e:
        raise ErrorMenu("No encontré la clave de administración del servidor de pedidos (datos/config.json).") from e


def validar_con_servidor(datos):
    srv = modulo_servidor()
    try:
        srv.validar_menu(copy.deepcopy(datos))
    except srv.ErrorPeticion as e:
        cuerpo = getattr(e, "cuerpo", {}) or {}
        raise ErrorMenu("El menú QR no acepta este cambio: " + str(cuerpo.get("mensaje") or e)) from e


def guardar_en_fuente(datos, huella_esperada):
    """Guarda en el menú del servidor de pedidos. Devuelve la nueva huella."""
    actual = archivo_fuente().read_text(encoding="utf-8")
    if huella(actual) != huella_esperada:
        raise ErrorMenu("El menú cambió fuera del editor (por ejemplo, desde el panel del servidor) desde que lo abrió. "
                        "Recargue la página para ver la versión actual (sus cambios no guardados se perderán).")
    datos = copy.deepcopy(datos)
    datos.pop("populares", None)
    validar_con_servidor(datos)
    if servidor_encendido():
        # Igual que el panel de administración: queda en su registro y el menú QR cambia al instante
        datos["versionBase"] = datos.get("version")
        peticion = urllib.request.Request(_url_servidor("/api/admin/menu"), method="PUT",
                                          data=json.dumps(datos, ensure_ascii=False).encode("utf-8"),
                                          headers={"Content-Type": "application/json", "X-Clave": _clave_admin()})
        try:
            with urllib.request.urlopen(peticion, timeout=15, context=_contexto_ssl()) as r:
                json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                cuerpo = json.loads(e.read())
                detalle = cuerpo.get("mensaje") or cuerpo.get("error")
            except ValueError:
                detalle = None
            raise ErrorMenu(detalle or f"El servidor de pedidos rechazó el cambio (error {e.code}).") from e
        except (OSError, urllib.error.URLError) as e:
            raise ErrorMenu(f"No se pudo hablar con el servidor de pedidos: {e}") from e
    else:
        # Servidor apagado: se escribe el archivo como lo haría él; lo cargará al arrancar
        srv = modulo_servidor()
        CARPETA_RESPALDOS.mkdir(parents=True, exist_ok=True)
        (CARPETA_RESPALDOS / f"menu-json-{datetime.now():%Y%m%d-%H%M%S-%f}.json").write_text(actual, encoding="utf-8")
        for viejo in sorted(CARPETA_RESPALDOS.glob("menu-json-*.json"))[:-MAX_RESPALDOS]:
            viejo.unlink(missing_ok=True)
        datos["version"] = int(datos.get("version") or 1) + 1
        texto = json.dumps(datos, ensure_ascii=False, indent=2)
        srv.escribir_atomico(str(archivo_fuente()), texto)
        datos_js = SERVIDOR.parent / "menu" / "js" / "datos.js"
        if datos_js.parent.is_dir():
            srv.escribir_atomico(str(datos_js), srv.CABECERA_DATOS_JS + "window.MENU_DATOS = " + texto + ";\n")
    nuevo = archivo_fuente().read_text(encoding="utf-8")
    exportar_web(json.loads(nuevo))
    return huella(nuevo)


def exportar_web(datos):
    """Copia pública del menú para la web: sin mesas, claves, traducciones ni datos internos."""
    publico = copy.deepcopy(datos)
    for clave in ("traducciones", "populares", "versionBase"):
        publico.pop(clave, None)
    config = publico.get("config") or {}
    publico["config"] = {k: config[k] for k in CONFIG_PUBLICA if k in config}
    # Las fotos del menú QR (fotos/…) se copian a la web con la misma ruta
    destino = CARPETA_WEB / "fotos"
    for c in publico.get("categorias", {}).values():
        for obj in [c] + c.get("platos", []):
            foto = str(obj.get("foto") or "")
            if foto.startswith("fotos/"):
                origen = carpeta_fotos_servidor() / foto[len("fotos/"):]
                if origen.is_file():
                    destino.mkdir(exist_ok=True)
                    if not (destino / origen.name).exists():
                        shutil.copy2(origen, destino / origen.name)
    texto = serializar(publico)
    if not ARCHIVO_MENU.exists() or ARCHIVO_MENU.read_text(encoding="utf-8") != texto:
        fd, temporal = tempfile.mkstemp(prefix=".menu-", suffix=".js", dir=CARPETA_WEB)
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(texto)
        os.chmod(temporal, 0o644)
        os.replace(temporal, ARCHIVO_MENU)


def normalizar_foto(datos):
    """Orienta, recorta al centro y codifica una imagen real, nunca solo su cabecera."""
    if Image is None:
        raise ErrorMenu("Falta Pillow. Instálelo con: python3 -m pip install -r editor/requirements.txt")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(datos)) as original:
                if original.format not in ("JPEG", "PNG", "WEBP"):
                    raise ErrorMenu("Formato no admitido. Use JPG, PNG o WebP.")
                original.load()
                imagen = ImageOps.exif_transpose(original)
                if min(imagen.size) < 100:
                    raise ErrorMenu("La imagen es demasiado pequeña: use una de al menos 100 píxeles por lado.")
                # Un fondo blanco evita convertir transparencias en manchas negras.
                rgba = imagen.convert("RGBA")
                fondo = Image.new("RGBA", rgba.size, "white")
                fondo.alpha_composite(rgba)
                rgb = fondo.convert("RGB")
                recorte = ImageOps.fit(rgb, TAMANO_FOTO, method=Image.Resampling.LANCZOS)
                salida = io.BytesIO()
                recorte.save(salida, "WEBP", quality=88, method=6)
                return salida.getvalue()
    except ErrorMenu:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as e:
        raise ErrorMenu("No se pudo leer la imagen. Use un JPG, PNG o WebP válido y de tamaño razonable.") from e


# ---------------------------------------------------------------------------
# Lectura y escritura de menu-datos.js
# ---------------------------------------------------------------------------
def leer_menu():
    if SERVIDOR:
        texto = archivo_fuente().read_text(encoding="utf-8")
        try:
            return json.loads(texto), huella(texto)
        except json.JSONDecodeError as e:
            raise ErrorMenu(f"El menu.json del servidor no es válido (línea {e.lineno}): {e.msg}") from e
    return leer_copia_web()


def leer_copia_web():
    texto = ARCHIVO_MENU.read_text(encoding="utf-8")
    m = re.search(re.escape(VARIABLE) + r"\s*=\s*", texto)
    if not m:
        raise ErrorMenu(f"No se encontró «{VARIABLE} = …» en {ARCHIVO_MENU.name}.")
    cuerpo = texto[m.end():].strip()
    if cuerpo.endswith(";"):
        cuerpo = cuerpo[:-1]
    try:
        datos = json.loads(cuerpo)
    except json.JSONDecodeError as e:
        raise ErrorMenu(f"{ARCHIVO_MENU.name} no tiene un JSON válido (línea {e.lineno}): {e.msg}") from e
    return datos, huella(texto)


def huella(texto):
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:16]


def serializar(datos):
    return CABECERA + VARIABLE + " = " + json.dumps(datos, ensure_ascii=False, indent=1, allow_nan=False) + ";\n"


def guardar_menu(datos, huella_esperada):
    """Guarda en la fuente única (servidor de pedidos) o, sin él, solo en la copia de la web."""
    if SERVIDOR:
        return guardar_en_fuente(datos, huella_esperada)
    return guardar_copia_web(datos, huella_esperada)


def guardar_copia_web(datos, huella_esperada):
    """Guarda con respaldo previo y escritura atómica. Devuelve la nueva huella."""
    actual = ARCHIVO_MENU.read_text(encoding="utf-8")
    if huella(actual) != huella_esperada:
        raise ErrorMenu("El archivo del menú cambió fuera del editor desde que lo abrió. "
                        "Recargue la página para ver la versión actual (sus cambios no guardados se perderán).")
    nuevo = serializar(datos)
    if nuevo == actual:
        return huella(actual)
    CARPETA_RESPALDOS.mkdir(exist_ok=True)
    marca = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    (CARPETA_RESPALDOS / f"menu-datos-{marca}.js").write_text(actual, encoding="utf-8")
    respaldos = sorted(CARPETA_RESPALDOS.glob("menu-datos-*.js"))
    for viejo in respaldos[:-MAX_RESPALDOS]:
        viejo.unlink(missing_ok=True)
    fd, temporal = tempfile.mkstemp(prefix=".menu-", suffix=".js", dir=CARPETA_WEB)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(nuevo)
        os.chmod(temporal, 0o644)
        os.replace(temporal, ARCHIVO_MENU)
    except BaseException:
        Path(temporal).unlink(missing_ok=True)
        raise
    return huella(nuevo)


# ---------------------------------------------------------------------------
# Validación (lo que la web necesita para mostrar la carta)
# ---------------------------------------------------------------------------
def es_texto(v):
    if isinstance(v, str):
        return True
    return isinstance(v, dict) and bool(v) and all(isinstance(t, str) for t in v.values())


def texto_es(v):
    return v if isinstance(v, str) else v.get("es", "") if isinstance(v, dict) and isinstance(v.get("es"), str) else ""


def es_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0 and v == v and v != float("inf")


def es_precio_entero(v):
    """Un importe exacto, sin redondear los centavos de los datos."""
    return es_numero(v) and v % 1 == 0


def validar(d):
    errores = []
    if not isinstance(d, dict):
        raise ErrorMenu("El menú debe ser un objeto.")
    cats, momentos, config = d.get("categorias"), d.get("momentos"), d.get("config", {})
    if not isinstance(cats, dict):
        raise ErrorMenu("El menú no tiene categorías.")
    if not isinstance(momentos, dict) or not momentos:
        raise ErrorMenu("El menú no tiene momentos (desayuno, almuerzo…).")

    vistos = {}
    for cid, c in cats.items():
        if not isinstance(cid, str) or not ID_VALIDO.fullmatch(cid):
            errores.append(f"Identificador de categoría inválido: «{cid}».")
        if not isinstance(c, dict):
            errores.append(f"La categoría «{cid}» no es válida.")
            continue
        nombre_c = texto_es(c.get("nombre")).strip()
        if not es_texto(c.get("nombre")) or not nombre_c:
            errores.append(f"La categoría «{cid}» no tiene nombre.")
        for campo in ("resumen", "nota"):
            if campo in c and not es_texto(c[campo]):
                errores.append(f"«{campo}» inválido en la categoría {nombre_c or cid}.")
        if not isinstance(c.get("incluye", ""), str) or c.get("incluye", "") not in INCLUYE:
            errores.append(f"«incluye» inválido en la categoría {nombre_c or cid}.")
        if "foto" in c and not foto_valida(c["foto"]):
            errores.append(f"Foto inválida en la categoría {nombre_c or cid}.")
        if "fotoReferencia" in c and not isinstance(c["fotoReferencia"], bool):
            errores.append(f"«Foto de referencia» inválida en la categoría {nombre_c or cid}.")
        platos = c.get("platos")
        if not isinstance(platos, list):
            errores.append(f"La categoría {nombre_c or cid} no tiene lista de platos.")
            continue
        for p in platos:
            pid = p.get("id") if isinstance(p, dict) else None
            donde = f"«{texto_es(p.get('n')) or pid}» ({nombre_c or cid})" if isinstance(p, dict) else nombre_c
            if not isinstance(pid, str) or not ID_VALIDO.fullmatch(pid):
                errores.append(f"Identificador inválido en {donde}: use minúsculas, números y guiones.")
                continue
            if pid in vistos:
                errores.append(f"El identificador «{pid}» está repetido ({vistos[pid]} y {nombre_c}).")
            vistos[pid] = nombre_c or cid
            if not es_texto(p.get("n")) or not texto_es(p.get("n")).strip():
                errores.append(f"Un plato de {nombre_c or cid} no tiene nombre ({pid}).")
            if "d" in p and not es_texto(p["d"]):
                errores.append(f"Descripción inválida en {donde}.")
            pres = p.get("pres")
            if pres is not None:
                if not isinstance(pres, list) or not pres or not all(
                        isinstance(x, list) and len(x) == 2 and isinstance(x[0], str) and x[0].strip() and es_precio_entero(x[1])
                        for x in pres):
                    errores.append(f"Las presentaciones de {donde} necesitan nombre y precio entero, sin centavos (p. ej. 150).")
            elif not es_precio_entero(p.get("p")):
                errores.append(f"El precio de {donde} debe ser un número entero, sin centavos (p. ej. 150).")
            if not isinstance(p.get("t", []), list) or not all(isinstance(t, str) for t in p.get("t", [])):
                errores.append(f"Etiquetas inválidas en {donde}.")
            if "op" in p and (not isinstance(p["op"], list) or not all(es_texto(o) and texto_es(o).strip() for o in p["op"])):
                errores.append(f"Opciones inválidas en {donde}.")
            if "agotado" in p and not isinstance(p["agotado"], bool):
                errores.append(f"«Agotado» inválido en {donde}.")
            if "foto" in p and not foto_valida(p["foto"]):
                errores.append(f"Foto inválida en {donde}.")
            if "fotoReferencia" in p and not isinstance(p["fotoReferencia"], bool):
                errores.append(f"«Foto de referencia» inválida en {donde}.")
            if not isinstance(p.get("incluye", ""), str) or p.get("incluye", "") not in INCLUYE:
                errores.append(f"«incluye» inválido en {donde}.")

    for mid, m in momentos.items():
        if not isinstance(mid, str) or not ID_VALIDO.fullmatch(mid):
            errores.append("Identificador de momento inválido.")
        grupos = m.get("grupos") if isinstance(m, dict) else None
        if not isinstance(grupos, list):
            errores.append(f"El momento «{mid}» no tiene secciones.")
            continue
        for g in grupos:
            if not isinstance(g, dict) or not es_texto(g.get("n")) or not texto_es(g.get("n")).strip():
                errores.append(f"Hay una sección sin nombre en «{mid}».")
                continue
            if "nota" in g and not es_texto(g["nota"]):
                errores.append(f"Nota inválida en la sección {texto_es(g['n'])}.")
            if not isinstance(g.get("cats"), list):
                errores.append(f"La sección {texto_es(g['n'])} no tiene categorías.")
                continue
            asignadas = set()
            for cid in g["cats"]:
                if not isinstance(cid, str) or cid not in cats:
                    errores.append(f"La sección {texto_es(g['n'])} ({mid}) usa la categoría inexistente «{cid}».")
                elif cid in asignadas:
                    errores.append(f"La sección {texto_es(g['n'])} repite la categoría «{cid}».")
                else:
                    asignadas.add(cid)

    if not isinstance(config, dict):
        errores.append("La configuración no es válida.")
    else:
        horarios = config.get("horario", {})
        if not isinstance(horarios, dict):
            errores.append("Los horarios deben ser un objeto.")
            horarios = {}
        for mid, h in horarios.items():
            if not isinstance(h, dict) or not all(HORA_VALIDA.fullmatch(str(h.get(k, ""))) for k in ("desde", "hasta")):
                errores.append(f"Horario inválido para «{mid}»: use HH:MM (24 h).")
        if "iva" in config and not (es_numero(config["iva"]) and config["iva"] < 1):
            errores.append("El IVA debe ser un número entre 0 y 1 (p. ej. 0.15 para 15 %).")
        if "tipoCambio" in config and not es_numero(config["tipoCambio"]):
            errores.append("El tipo de cambio debe ser un número.")
        if "moneda" in config and not isinstance(config["moneda"], str):
            errores.append("La moneda debe ser un texto.")
        bebidas = config.get("bebidasDesayuno", [])
        if not isinstance(bebidas, list):
            errores.append("Las bebidas del desayuno deben ser una lista.")
            bebidas = []
        for bid in bebidas:
            if not isinstance(bid, str) or bid not in vistos:
                errores.append(f"La bebida incluida en el desayuno «{bid}» ya no existe en la carta.")
        hotel = config.get("hotel")
        if hotel is not None:
            if not isinstance(hotel, dict):
                errores.append("Los datos de contacto no son válidos.")
            else:
                for campo in ("nombre", "restaurante"):
                    if campo in hotel and not (isinstance(hotel[campo], str) and hotel[campo].strip()):
                        errores.append(f"«{campo}» debe ser un texto con nombre en los datos del hotel.")
                if "ubicacion" in hotel and not (isinstance(hotel["ubicacion"], str)
                        and hotel["ubicacion"].strip() and len(hotel["ubicacion"]) <= 300):
                    errores.append("La ubicación en Google Maps debe ser un texto no vacío de hasta 300 caracteres.")
                telefonos = hotel.get("telefonos", [])
                if not isinstance(telefonos, list):
                    errores.append("Los teléfonos deben ser una lista.")
                    telefonos = []
                for t in telefonos:
                    if not (isinstance(t, dict) and isinstance(t.get("texto"), str) and isinstance(t.get("tel"), str)
                            and t["texto"].strip() and re.fullmatch(r"\+?[0-9]{6,15}", t["tel"])):
                        errores.append("Cada teléfono necesita el texto visible y el número para marcar (p. ej. +50527322668).")
                cel = hotel.get("celular")
                if cel and not (isinstance(cel, dict) and re.fullmatch(r"\+?[0-9]{6,15}", str(cel.get("tel", "")))):
                    errores.append("El número para marcar del celular no es válido.")
                for campo in ("direccion", "lema"):
                    if campo in hotel and not es_texto(hotel[campo]):
                        errores.append(f"«{campo}» inválido en los datos del hotel.")
                if "correo" in hotel and not isinstance(hotel["correo"], str):
                    errores.append("El correo debe ser un texto.")
    if errores:
        raise ErrorMenu("\n".join(dict.fromkeys(errores)))


def tamano_imagen(datos):
    """Ancho y alto de un WebP (VP8, VP8L, VP8X) o JPEG leyendo solo la cabecera."""
    import struct
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        trozo = datos[12:16]
        if trozo == b"VP8X":
            return 1 + int.from_bytes(datos[24:27], "little"), 1 + int.from_bytes(datos[27:30], "little"), ".webp"
        if trozo == b"VP8 " and datos[23:26] == b"\x9d\x01\x2a":
            w, h = struct.unpack("<HH", datos[26:30])
            return w & 0x3FFF, h & 0x3FFF, ".webp"
        if trozo == b"VP8L" and datos[20:21] == b"\x2f":
            b = int.from_bytes(datos[21:25], "little")
            return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1, ".webp"
    if datos[:3] == b"\xff\xd8\xff":
        i = 2
        while i + 9 < len(datos):
            if datos[i] != 0xFF:
                i += 1
                continue
            marca = datos[i + 1]
            if marca in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", datos[i + 5:i + 9])
                return w, h, ".jpg"
            i += 2 + int.from_bytes(datos[i + 2:i + 4], "big")
    return None


def comprobar_foto_recortada(datos):
    """Sin Pillow solo se aceptan fotos que el navegador ya dejó a 960 × 640."""
    info = tamano_imagen(datos)
    if not info:
        raise ErrorMenu("Formato no admitido. Use JPG, PNG o WebP.")
    if info[:2] != TAMANO_FOTO:
        raise ErrorMenu(f"La foto debe llegar recortada a {TAMANO_FOTO[0]} × {TAMANO_FOTO[1]}. Recargue el editor e inténtelo de nuevo.")
    return info[2]


def foto_valida(valor):
    if not isinstance(valor, str) or len(valor) > 2000:
        return False
    if not valor:
        return True
    ruta = urlparse(valor)
    if ruta.scheme:
        return ruta.scheme in ("http", "https") and bool(ruta.netloc)
    return not ruta.netloc and not ruta.path.startswith("/") and ".." not in Path(ruta.path).parts


# ---------------------------------------------------------------------------
# Servidor local
# ---------------------------------------------------------------------------
class Editor(SimpleHTTPRequestHandler):
    token = ""
    candado = threading.Lock()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CARPETA_WEB), **kwargs)

    def log_message(self, formato, *args):  # silencio salvo errores
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def responder_json(self, estado, cuerpo):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def origen_local(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def do_GET(self):
        if not self.origen_local():
            return self.send_error(HTTPStatus.FORBIDDEN)
        ruta = urlparse(self.path).path
        if ruta in ("/", "/editor"):
            html = PAGINA_EDITOR.read_text(encoding="utf-8").replace("__TOKEN__", self.token).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; "
                             "script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'")
            self.end_headers()
            return self.wfile.write(html)
        if ruta == "/api/menu":
            try:
                datos, h = leer_menu()
            except (OSError, ErrorMenu) as e:
                return self.responder_json(500, {"error": str(e)})
            fuente = {"servidor": bool(SERVIDOR), "encendido": bool(SERVIDOR) and servidor_encendido()}
            return self.responder_json(200, {"menu": datos, "huella": h, "fuente": fuente})
        if ruta.startswith("/web/") or ruta == "/web":
            # Vista previa de la web real (sirve la carpeta del sitio)
            self.path = self.path[4:] or "/"
            if ".." in self.path or self.path.startswith("/editor"):
                return self.send_error(HTTPStatus.NOT_FOUND)
            return super().do_GET()
        self.send_error(HTTPStatus.NOT_FOUND)

    def guardar_foto(self, tipo, ident):
        """Guarda la foto de un plato o una categoría siempre a 960 × 640 (3:2).

        Con Pillow, el servidor recorta y convierte cualquier JPG/PNG/WebP. Sin
        Pillow, acepta la imagen que el navegador ya recortó (WebP o JPEG) y
        comprueba su tamaño. Cada foto recibe un nombre nuevo y nunca se borra
        ni se sobrescribe la anterior: «Descartar cambios» vuelve a la foto vieja
        y esta sigue existiendo.
        """
        if tipo not in TIPOS_FOTO or not ID_VALIDO.fullmatch(ident):
            return self.responder_json(400, {"error": "Destino de la foto inválido."})
        largo = int(self.headers.get("Content-Length") or 0)
        if largo <= 0 or largo > MAX_FOTO:
            return self.responder_json(413, {"error": "La foto está vacía o pesa más de 12 MB."})
        datos = self.rfile.read(largo)
        try:
            if Image is not None:
                datos, ext = normalizar_foto(datos), ".webp"
            else:
                ext = comprobar_foto_recortada(datos)
        except ErrorMenu as e:
            return self.responder_json(415, {"error": str(e)})
        # Con el servidor de pedidos, las fotos van a su carpeta fotos/ (la que exige el menú QR)
        # y se copian a la web con la misma ruta; sin él, a assets/imagenes/<tipo>/.
        carpeta = carpeta_fotos_servidor() if SERVIDOR else CARPETA_FOTOS / tipo
        carpeta.mkdir(parents=True, exist_ok=True)
        with self.candado:
            nombre = f"{ident}-{datetime.now():%Y%m%d-%H%M%S}-{secrets.token_hex(2)}{ext}"
            fd, temporal = tempfile.mkstemp(prefix=".foto-", dir=carpeta)
            with os.fdopen(fd, "wb") as f:
                f.write(datos)
            os.chmod(temporal, 0o644)
            os.replace(temporal, carpeta / nombre)
        if SERVIDOR:
            (CARPETA_WEB / "fotos").mkdir(exist_ok=True)
            shutil.copy2(carpeta / nombre, CARPETA_WEB / "fotos" / nombre)
            return self.responder_json(200, {"foto": f"fotos/{nombre}"})
        return self.responder_json(200, {"foto": f"{RUTA_FOTOS}{tipo}/{nombre}"})

    def do_PUT(self):
        ruta = urlparse(self.path).path
        if ruta.startswith("/api/foto/") and self.origen_local():
            if not secrets.compare_digest(self.headers.get("X-Editor-Token", ""), self.token):
                return self.responder_json(403, {"error": "Sesión del editor no válida. Recargue la página."})
            partes = ruta[len("/api/foto/"):].split("/")
            if len(partes) != 2:
                return self.responder_json(400, {"error": "Destino de la foto inválido."})
            return self.guardar_foto(*partes)
        if ruta != "/api/menu" or not self.origen_local():
            return self.send_error(HTTPStatus.NOT_FOUND)
        if not secrets.compare_digest(self.headers.get("X-Editor-Token", ""), self.token):
            return self.responder_json(403, {"error": "Sesión del editor no válida. Recargue la página."})
        largo = int(self.headers.get("Content-Length") or 0)
        if largo <= 0 or largo > MAX_CUERPO:
            return self.responder_json(413, {"error": "Datos demasiado grandes o vacíos."})
        try:
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
            menu, esperada = cuerpo["menu"], cuerpo["huella"]
            validar(menu)
            with self.candado:
                nueva = guardar_menu(menu, esperada)
        except ErrorMenu as e:
            return self.responder_json(409 if "cambió fuera" in str(e) else 400, {"error": str(e)})
        except (KeyError, ValueError, TypeError):
            return self.responder_json(400, {"error": "Petición inválida."})
        except OSError as e:
            return self.responder_json(500, {"error": f"No se pudo guardar el archivo: {e}"})
        print(f"[{datetime.now():%H:%M:%S}] Menú guardado en {ARCHIVO_MENU.name}")
        return self.responder_json(200, {"huella": nueva})


def main():
    ap = argparse.ArgumentParser(description="Editor del menú de la web del Hotel Frontera")
    ap.add_argument("--puerto", type=int, default=8090)
    ap.add_argument("--sin-navegador", action="store_true")
    ap.add_argument("--sincronizar", action="store_true",
                    help="solo regenera la copia de la web (menu-datos.js) desde el menú del servidor de pedidos")
    ap.add_argument("--solo-web", action="store_true", help="editar solo la copia de la web (sin el servidor de pedidos)")
    args = ap.parse_args()

    global SERVIDOR
    SERVIDOR = None if args.solo_web else carpeta_servidor()
    if args.sincronizar:
        if not SERVIDOR:
            print("No se encontró el servidor de pedidos; la web conserva su copia actual del menú.")
            return
        exportar_web(json.loads(archivo_fuente().read_text(encoding="utf-8")))
        print(f"Copia de la web actualizada desde {archivo_fuente()}")
        return
    if SERVIDOR:
        print(f"Menú único: {archivo_fuente()} (lo usan el menú QR y la web)")
        print("Servidor de pedidos " + ("ENCENDIDO: los cambios se guardan por su panel y el menú QR cambia al instante."
                                       if servidor_encendido() else "apagado: los cambios se guardan en su archivo y los verá al arrancarlo."))
    else:
        print("Aviso: no se encontró el servidor de pedidos; solo se edita la copia de la web (menu-datos.js).")

    try:
        validar(leer_menu()[0])
    except FileNotFoundError:
        sys.exit(f"No se encontró {ARCHIVO_MENU}. El editor debe estar en la carpeta editor/ de la web.")
    except ErrorMenu as e:
        print("Aviso: el menú actual tiene problemas que deberá corregir antes de guardar:\n" + str(e))

    Editor.token = secrets.token_urlsafe(24)
    try:
        servidor = ThreadingHTTPServer(("127.0.0.1", args.puerto), Editor)
    except OSError:
        sys.exit(f"El puerto {args.puerto} está ocupado. Pruebe con: --puerto {args.puerto + 1}")
    url = f"http://127.0.0.1:{args.puerto}/"
    print(f"Editor del menú abierto en {url}\nArchivo: {ARCHIVO_MENU}\nPara cerrar: Ctrl+C")
    if not args.sin_navegador:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nEditor cerrado.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
