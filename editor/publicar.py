#!/usr/bin/env python3
"""
Publica la web del Hotel Frontera. Lo usa publicar.command.

  1. Trae los precios cambiados en el editor de la web (/precios/, en Cloudflare)
     y lo que se publicó en GitHub desde otro lugar (otra computadora, Codex).
  2. Pasa esos precios al menú único (servidor de pedidos / menú QR). Si el mismo
     precio cambió en los dos lados, gana el cambio más reciente y se avisa.
  3. Regenera la copia de la web (menu-datos.js) desde el menú único.
  4. Guarda todo en un commit y lo sube a GitHub. Cloudflare (y GitHub Pages)
     actualizan la web en 1 o 2 minutos.

Nunca fuerza la subida ni borra trabajo: si algo no se puede unir solo, se detiene,
explica qué pasó y no sube nada.

Uso:  python3 editor/publicar.py
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

CARPETA_EDITOR = Path(__file__).resolve().parent
RAIZ = CARPETA_EDITOR.parent
sys.path.insert(0, str(CARPETA_EDITOR))
import editor_menu as em  # noqa: E402  (mismo editor: mismas reglas y mismo formato)

ARCHIVO = "menu-datos.js"
PAGINAS_CON_VERSION = ("index.html", "precios/index.html")
RESPALDO_DIRECCION = "https://agustin627.github.io/hofrosa-web/"
INTENTOS = 3


class Alto(Exception):
    """Se detiene la publicación con un mensaje para la persona (no se subió nada)."""


def git(*args, ok=(0,)):
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, encoding="utf-8", errors="replace", timeout=300)
    if r.returncode not in ok:
        raise Alto(f"git {' '.join(args)} falló:\n{(r.stderr or r.stdout).strip()}")
    return r


def salida(*args):
    return git(*args).stdout.strip()


def git_en_pantalla(*args):
    """fetch y push se ven en la terminal: si GitHub pide usuario o clave, se puede escribir."""
    return subprocess.run(["git", *args], cwd=RAIZ, timeout=600).returncode == 0


def archivo_en(rev):
    r = subprocess.run(["git", "show", f"{rev}:{ARCHIVO}"], cwd=RAIZ, capture_output=True, timeout=60)
    return r.stdout.decode("utf-8") if r.returncode == 0 else None


def url_sitio():
    """La dirección de la web es la del enlace canonical de index.html (un solo lugar para cambiarla)."""
    try:
        m = re.search(r'<link rel="canonical" href="(https://[^"]+)"', (RAIZ / "index.html").read_text(encoding="utf-8"))
    except OSError:
        m = None
    return m.group(1) if m else RESPALDO_DIRECCION


ULTIMA_CONSULTA = {"motivo": None}   # qué respondió el editor de la web la última vez


def direccion_api():
    """Dónde pedir los precios cambiados en la web (HOFROSA_PRECIOS_WEB sirve para las pruebas)."""
    return os.environ.get("HOFROSA_PRECIOS_WEB") or url_sitio().rstrip("/") + "/api/precios-web"


def traer_precios_web():
    """Precios cambiados en el editor de la web que falta pasar al menú QR.
    Devuelve (lista, None) o (None, motivo): «sin-editor» si la web todavía no está en
    Cloudflare (no hay nada que traer) o «sin-conexion» si no respondió."""
    url = direccion_api()
    if ".github.io/" in url:
        return None, "sin-editor"   # GitHub Pages no tiene editor de precios
    try:
        peticion = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "hofrosa-publicar/1"})
        with urllib.request.urlopen(peticion, timeout=20) as r:
            if "json" not in (r.headers.get("Content-Type") or ""):
                return None, "sin-editor"
            datos = json.loads(r.read(2_000_000).decode("utf-8"))
    except urllib.error.HTTPError as e:
        return None, ("sin-conexion" if e.code >= 500 else "sin-editor")
    except (urllib.error.URLError, OSError):
        return None, "sin-conexion"
    except (ValueError, UnicodeDecodeError):
        return None, "sin-editor"
    if not isinstance(datos, dict) or not isinstance(datos.get("pendientes"), list):
        return None, "sin-editor"
    return datos["pendientes"], None


def hay_cambios():
    return bool(salida("status", "--porcelain"))


def ahora():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def comprobar_repositorio():
    if not (RAIZ / ".git").exists():
        raise Alto(f"{RAIZ} no es un repositorio git: no se puede publicar desde aquí.")
    for marca in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"):
        if (RAIZ / ".git" / marca).exists():
            raise Alto("git tiene una unión de cambios a medias. No se publicó nada: pida ayuda para terminarla o cancelarla.")
    rama = salida("rev-parse", "--abbrev-ref", "HEAD")
    if rama == "HEAD":
        raise Alto("git no está en una rama (por ejemplo, main). No se publicó nada.")
    r = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}", ok=(0, 128))
    arriba = r.stdout.strip() if r.returncode == 0 and "/" in r.stdout else f"origin/{rama}"
    remoto, rama_remota = arriba.split("/", 1)
    return arriba, remoto, rama_remota


def marcar_version():
    """Nueva marca en CSS/JS: el navegador nunca mezcla archivos viejos y nuevos."""
    version = datetime.now().strftime("%Y%m%d-%H%M%S")
    for nombre in PAGINAS_CON_VERSION:
        ruta = RAIZ / nombre
        if not ruta.is_file():
            continue
        texto = ruta.read_text(encoding="utf-8")
        nuevo = re.sub(r'\.(css|js)\?v=[0-9-]+"', lambda m: f'.{m.group(1)}?v={version}"', texto)
        if nuevo != texto:
            ruta.write_text(nuevo, encoding="utf-8")


def resolver_copia_sola(texto_base, texto_web, momento_web):
    """Sin servidor de pedidos, menu-datos.js es la fuente: se une a nivel de datos (precios)."""
    local = archivo_en("HEAD")
    if local is None or texto_base is None or texto_web is None:
        raise Alto(f"No se pudo unir {ARCHIVO} con la versión de GitHub. No se publicó nada.")
    propio, web = em.analizar_copia_web(local), em.analizar_copia_web(texto_web)
    cambios = em.cambios_de_precio(em.analizar_copia_web(texto_base), web)
    momento_local = int(salida("log", "-1", "--format=%ct", "HEAD", "--", ARCHIVO) or 0)
    resultado = em.fusionar_precios(cambios, propio, lambda _clave: momento_web >= momento_local)
    (RAIZ / ARCHIVO).write_text(em.serializar(propio), encoding="utf-8", newline="\n")
    return [[(em.nombre_precio(web, x[0]),) + tuple(x[1:]) for x in lista] for lista in resultado]


def publicar():
    arriba, remoto, rama_remota = comprobar_repositorio()
    em.SERVIDOR = em.carpeta_servidor()
    informe = {"aplicados": [], "choques": [], "ignorados": []}

    for intento in range(1, INTENTOS + 1):
        print("Trayendo de GitHub lo publicado desde otros lugares…", flush=True)
        if not git_en_pantalla("fetch", "-q", remoto, rama_remota):
            raise Alto("No se pudo hablar con GitHub (¿hay internet?). No se publicó nada.")
        if git("rev-parse", "--verify", "-q", arriba, ok=(0, 1)).returncode != 0:
            raise Alto(f"No existe {arriba} en GitHub. No se publicó nada.")
        base = git("merge-base", "HEAD", arriba, ok=(0, 1)).stdout.strip()
        if not base:
            raise Alto("Esta carpeta y GitHub no tienen historia en común. No se publicó nada: pida ayuda.")
        nuevo_arriba = salida("rev-parse", arriba) != base
        texto_base = texto_web = None
        momento_web = 0
        if nuevo_arriba:
            texto_base, texto_web = archivo_en(base), archivo_en(arriba)
            momento = salida("log", "-1", "--format=%ct", f"{base}..{arriba}", "--", ARCHIVO)
            momento_web = int(momento) if momento else 0

        # 1. Precios cambiados en la web → menú único. Va primero: si falla, git queda intacto.
        #    a) Los del editor de precios (Cloudflare)
        if em.SERVIDOR:
            pendientes, motivo = traer_precios_web()
            ULTIMA_CONSULTA["motivo"] = motivo
            if motivo == "sin-conexion":
                print("Aviso: no se pudieron consultar los precios cambiados en la web. Se publica igual;\n"
                      "       quedan guardados en la web y se traerán la próxima vez.", flush=True)
            elif pendientes:
                try:
                    aplicados, choques, ignorados = em.importar_pendientes_web(pendientes)
                except em.ErrorMenu as e:
                    raise Alto("No se pudieron pasar al menú QR los precios cambiados en la web:\n"
                               f"{e}\nNo se publicó nada: la web conserva sus precios.") from e
                informe["aplicados"] += aplicados
                informe["choques"] += choques
                informe["ignorados"] += ignorados
        #    b) Los que llegaron por GitHub (otra computadora, Codex)
        if em.SERVIDOR and texto_base and texto_web and texto_base != texto_web:
            try:
                aplicados, choques, ignorados = em.importar_precios_web(texto_base, texto_web, momento_web)
            except em.ErrorMenu as e:
                raise Alto("No se pudieron pasar al menú QR los precios cambiados en la web:\n"
                           f"{e}\nNo se publicó nada: la web conserva sus precios.") from e
            informe["aplicados"] += aplicados
            informe["choques"] += choques
            informe["ignorados"] += ignorados

        # 2. Lo de esta computadora queda en un commit antes de unir. Con servidor,
        #    menu-datos.js no se guarda: se vuelve a generar desde el menú único.
        if em.SERVIDOR:
            git("checkout", "HEAD", "--", ARCHIVO)
        if hay_cambios():
            marcar_version()   # código o estilos nuevos: el navegador no debe mezclarlos con los viejos
            git("add", "-A")
            git("commit", "-q", "-m", f"Cambios locales ({ahora()})")

        # 3. Unir lo de GitHub
        if nuevo_arriba:
            r = git("merge", "--no-edit", "-q", arriba, ok=(0, 1))
            if r.returncode != 0:
                en_choque = set(salida("diff", "--name-only", "--diff-filter=U").splitlines())
                if en_choque == {ARCHIVO}:
                    if em.SERVIDOR:
                        git("checkout", "--theirs", "--", ARCHIVO)   # se regenera enseguida
                    else:
                        aplicados, choques, ignorados = resolver_copia_sola(texto_base, texto_web, momento_web)
                        informe["aplicados"] += aplicados
                        informe["choques"] += choques
                        informe["ignorados"] += ignorados
                    git("add", "--", ARCHIVO)
                    git("commit", "-q", "--no-edit")
                else:
                    git("merge", "--abort", ok=(0, 128))
                    raise Alto("GitHub y esta computadora cambiaron los mismos archivos: "
                               + ", ".join(sorted(en_choque)) + ".\nNo se publicó nada y no se perdió nada. Pida ayuda para unirlos.")

        # 4. Copia de la web desde el menú único (el que usa el menú QR)
        if em.SERVIDOR:
            try:
                em.sincronizar_web()
            except em.ErrorMenu as e:
                raise Alto(f"El menú del servidor de pedidos tiene un problema y no se copió a la web:\n{e}") from e

        # 5. Guardar y subir
        if hay_cambios():
            marcar_version()
            git("add", "-A")
            git("commit", "-q", "-m", f"Actualización del menú y la web ({ahora()})")
        if int(salida("rev-list", "--count", f"{arriba}..HEAD")) == 0:
            return informe, False
        print("Subiendo a GitHub…", flush=True)
        if git_en_pantalla("push", "-q", remoto, f"HEAD:{rama_remota}"):
            return informe, True
        if intento < INTENTOS:
            print("GitHub recibió otro cambio mientras tanto. Se vuelve a intentar…", flush=True)
    raise Alto("No se pudo subir a GitHub. Los cambios quedaron guardados en esta computadora: "
               "vuelva a abrir publicar.command más tarde.")


def mostrar_informe(informe):
    if informe["aplicados"]:
        print("\nPrecios cambiados en la web que ahora también tiene el menú QR:")
        for nombre, antes, despues in informe["aplicados"]:
            print(f"  • {nombre}: {antes} → {despues}")
    if informe["choques"]:
        print("\nPrecios cambiados en la web Y en el menú QR (se dejó el cambio más reciente):")
        for nombre, antes, web, qr, gano in informe["choques"]:
            final = web if gano == "web" else qr
            print(f"  • {nombre}: antes {antes}; en la web {web}; en el menú QR {qr}. Quedó {final} ({gano}).")
    if informe["ignorados"]:
        print("\nCambios de la web que no se aplicaron:")
        for nombre, antes, web, motivo in informe["ignorados"]:
            print(f"  • {nombre}: {antes} → {web} ({motivo})")


def main():
    try:
        informe, subido = publicar()
    except Alto as e:
        print(f"\n{e}", file=sys.stderr)
        return 1
    except subprocess.TimeoutExpired:
        print("\ngit tardó demasiado en responder. No se publicó nada.", file=sys.stderr)
        return 1
    mostrar_informe(informe)
    print("\n" + ("Cambios publicados. La web se actualiza en 1 o 2 minutos." if subido else "No hay cambios nuevos que publicar."))
    if not em.SERVIDOR:
        print("Aviso: no se encontró el servidor de pedidos; se publicó la copia de la web tal como está.")
    sitio = url_sitio()
    if ULTIMA_CONSULTA["motivo"] == "sin-editor" and ".github.io/" not in direccion_api():
        print(f"Aviso: {sitio} todavía no tiene la web nueva con el editor de precios (falta terminar\n"
              f"       de configurar Cloudflare; vea el README). Mientras tanto se ve en {RESPALDO_DIRECCION}")
    print("Dirección de la web:\n" + sitio)
    return 0


if __name__ == "__main__":
    sys.exit(main())
