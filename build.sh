#!/bin/sh
# Rebuilds index.html from src/.
set -e
cd "$(dirname "$0")"
{
  cat src/01_head.html
  cat src/02_draw.js src/03_fireworks.js src/04_audio.js src/05_main.js
  echo '</script>'
  echo '</body></html>'
} > index.html
ls -la index.html
