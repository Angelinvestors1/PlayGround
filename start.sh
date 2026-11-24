#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/runner/work/PlayGround/PlayGround"
cd "$PROJECT_DIR"

run_timed() {
  local label="$1"
  shift
  echo "[$label] starting"
  /usr/bin/time -p -o "$PROJECT_DIR/.build-$label.time" "$@"
  echo "[$label] $([[ -f "$PROJECT_DIR/.build-$label.time" ]] && cat "$PROJECT_DIR/.build-$label.time" | tr '\n' ' ' || true)"
}

PORT="${PORT:-3000}"
rm -rf "$PROJECT_DIR/dist"
mkdir -p "$PROJECT_DIR/dist"
run_timed copy-static cp -R "$PROJECT_DIR/project-moat-import/public/." "$PROJECT_DIR/dist/"

mkdir -p /home/runner/work/_temp/omgithub-web
printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$PROJECT_DIR/dist" > /home/runner/work/_temp/omgithub-web/deployment-output.json

run_timed validate test -f "$PROJECT_DIR/dist/index.html"

export PROJECT_DIR="$PROJECT_DIR/dist"
cd "$PROJECT_DIR"
echo "Serving $PROJECT_DIR on port $PORT"
exec /usr/bin/time -p node -e '
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = process.env.PROJECT_DIR || "/home/runner/work/PlayGround/PlayGround/dist";
const port = Number(process.env.PORT || 3000);
const mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon",".woff2":"font/woff2"};
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400); res.end("Bad Request"); return; }
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end("Not Found"); return; }
    res.writeHead(200, {"Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control":"no-cache"});
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(port, "0.0.0.0", () => console.log(`Static server listening on http://0.0.0.0:${port}`));
' 
