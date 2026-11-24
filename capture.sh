#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/runner/work/PlayGround/PlayGround"
cd "$PROJECT_DIR"

run_timed() {
  local label="$1"
  shift
  echo "[$label] starting"
  /usr/bin/time -p -o "$PROJECT_DIR/.capture-$label.time" "$@"
  echo "[$label] timing: $(tr '\n' ' ' < "$PROJECT_DIR/.capture-$label.time")"
}

: "${CAPTURE_URL:?Set CAPTURE_URL}" 
: "${CAPTURE_DIR:?Set CAPTURE_DIR}"
mkdir -p "$CAPTURE_DIR"

RUNTIME_SCRIPT="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}/scripts/default-capture.mjs"
if [[ -f "$RUNTIME_SCRIPT" ]]; then
  run_timed browser-capture env CAPTURE_URL="$CAPTURE_URL" CAPTURE_DIR="$CAPTURE_DIR" node "$RUNTIME_SCRIPT"
else
  echo "Capture infrastructure not found: $RUNTIME_SCRIPT" >&2
  exit 75
fi

for shot in final-desktop.png final-mobile.png; do
  if [[ ! -s "$CAPTURE_DIR/$shot" ]]; then
    echo "Missing or empty capture: $CAPTURE_DIR/$shot" >&2
    exit 1
  fi
done

echo "Captured desktop and mobile views in $CAPTURE_DIR"
