#!/usr/bin/env bash
# Sincroniza el menú y publica la web en GitHub Pages.
# En Mac: doble clic sobre este archivo. En la terminal: ./publicar.command
# Al subir los cambios a GitHub, la web se actualiza sola en 1 o 2 minutos:
# https://agustin627.github.io/hofrosa-web/
set -euo pipefail
cd "$(dirname "$0")"

# El menú es uno solo (el del servidor de pedidos / menú QR): se copia a la web antes de publicar
python3 editor/editor_menu.py --sincronizar

if [ -z "$(git status --porcelain)" ]; then
  echo "No hay cambios nuevos que publicar."
else
  # Nueva marca de versión en CSS/JS: el navegador nunca mezcla archivos viejos y nuevos
  version="$(date '+%Y%m%d-%H%M%S')"
  sed -i.bak -E "s/\.(css|js)\?v=[0-9-]+\"/.\1?v=${version}\"/g" index.html && rm -f index.html.bak
  git add -A
  git commit -q -m "Actualización del menú y la web ($(date '+%Y-%m-%d %H:%M'))"
  git push -q
  echo "Cambios publicados. La web se actualiza en 1 o 2 minutos."
fi
echo "Dirección de la web:"
echo "https://agustin627.github.io/hofrosa-web/"
echo
read -r -p "Pulse Enter para cerrar…" _ || true
