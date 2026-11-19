#!/bin/bash
# Build a local DEMO copy with the real starting data (never committed) and serve it.
# usage: tests/demo.sh <outdir> <port>
OUT=${1:-/tmp/mytool_demo}; PORT=${2:-8099}
SEED=${SEED_DIR:-/tmp/mt_seed_start}
R=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$OUT"; ln -sfn "$R/vendor" "$OUT/vendor"; ln -sfn "$R/assets" "$OUT/assets"; cp "$R/manifest.webmanifest" "$OUT/"
python3 "$R/build.py" --demo-seed "$SEED" --out "$OUT/index.html" || exit 1
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then (cd "$OUT" && nohup python3 -m http.server "$PORT" >/tmp/mt_http_$PORT.log 2>&1 &); sleep 1; fi
echo "demo: http://localhost:$PORT/index.html?demo"
