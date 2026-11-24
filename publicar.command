#!/usr/bin/env bash
# Sube a internet (GitHub Pages) los cambios de la web y del menú.
# En Mac: doble clic sobre este archivo. En la terminal: ./publicar.command
# La web queda en https://agustin627.github.io/hofrosa-web/ (tarda 1–2 minutos).
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "$(git status --porcelain)" ]; then
  echo "No hay cambios nuevos que publicar."
else
  git add -A
  git commit -q -m "Actualización del menú y la web ($(date '+%Y-%m-%d %H:%M'))"
  git push -q
  echo "Cambios publicados. En 1 o 2 minutos se verán en:"
  echo "https://agustin627.github.io/hofrosa-web/"
fi
echo
read -r -p "Pulse Enter para cerrar…" _ || true
