#!/usr/bin/env python3
"""Prepara únicamente los archivos públicos de la web para Sites."""
from pathlib import Path
import shutil

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "dist"
ARCHIVOS = (
    "index.html", "styles.css", "app.js", "web-config.js", "menu-datos.js", "idiomas.js",
    "favicon.svg", "favicon-frontera.svg", "favicon-frontera.ico", "favicon-frontera-32.png",
    "apple-touch-icon-frontera.png", ".nojekyll",
)


def preparar():
    if DESTINO.is_symlink():
        raise RuntimeError("La carpeta dist no puede ser un enlace simbólico.")
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir()
    for nombre in ARCHIVOS:
        shutil.copy2(RAIZ / nombre, DESTINO / nombre)
    for nombre in ("assets", "fotos"):
        if (RAIZ / nombre).is_dir():
            shutil.copytree(RAIZ / nombre, DESTINO / nombre, ignore=shutil.ignore_patterns(".DS_Store"))
    print("Sitio preparado en dist/ (sin editor, ajustes ni respaldos).")


if __name__ == "__main__":
    preparar()
