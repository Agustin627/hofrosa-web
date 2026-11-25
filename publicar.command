#!/usr/bin/env bash
# Sincroniza el menú y guarda una copia de los cambios en GitHub.
# En Mac: doble clic sobre este archivo. En la terminal: ./publicar.command
# La dirección principal se publica con Sites desde Codex.
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
  echo "Cambios guardados en GitHub."
fi
echo "Para actualizar la dirección principal, pida a Codex que publique el sitio:"
echo "https://hotelfrontera.gracefulperiwinkle9.chatgpt.site/"
echo
read -r -p "Pulse Enter para cerrar…" _ || true
