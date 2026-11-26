#!/usr/bin/env bash
# Publica la web en GitHub Pages: trae los precios cambiados en la web (precios/),
# los pasa al menú QR, regenera la copia de la web y sube todo a GitHub.
# En Mac: doble clic sobre este archivo. En la terminal: ./publicar.command
# Dirección de la web: https://agustin627.github.io/hofrosa-web/
cd "$(dirname "$0")" || exit 1
python3 editor/publicar.py
estado=$?
echo
read -r -p "Pulse Enter para cerrar…" _ || true
exit "$estado"
