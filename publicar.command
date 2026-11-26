#!/usr/bin/env bash
# Publica la web: trae los precios cambiados en el editor de la web (/precios/),
# los pasa al menú QR, regenera la copia de la web y sube todo a GitHub.
# Cloudflare la publica sola en 1 o 2 minutos (GitHub Pages queda de respaldo).
# En Mac: doble clic sobre este archivo. En la terminal: ./publicar.command
# Dirección de la web: la del enlace «canonical» de index.html.
cd "$(dirname "$0")" || exit 1
python3 editor/publicar.py
estado=$?
echo
read -r -p "Pulse Enter para cerrar…" _ || true
exit "$estado"
