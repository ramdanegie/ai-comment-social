#!/usr/bin/env bash
# Build a self-contained Node release for cPanel shared hosting (Passenger + cron).
#
#   release/
#     app.js                 ← Passenger "Application startup file"
#     dist/server.cjs        ← API
#     dist/worker.cjs        ← cron: one worker pass
#     dist/migrate.cjs       ← schema migrations + default plans
#     dist/users.cjs         ← account provisioning CLI
#     drizzle/               ← SQL migrations
#     package.json
#
# .env is NOT part of the release; it lives only on the server.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=release
rm -rf "$OUT"
mkdir -p "$OUT/dist"

bun build src/node/server.ts src/node/worker.ts src/node/migrate.ts src/node/users.ts \
  --target=node --format=cjs --outdir "$OUT/dist" --entry-naming '[name].cjs' --minify-syntax

cp -R ../../packages/db/drizzle "$OUT/drizzle"

cat > "$OUT/app.js" <<'JS'
// Passenger startup file (cPanel → Setup Node.js App).
// This file is NOT bundled, so __dirname is the real app root — Passenger may start us with another cwd.
process.env.APP_ROOT = process.env.APP_ROOT || __dirname;
const fs = require('node:fs');
const logFile = __dirname + '/logs/app.log';
const log = (msg) => {
  try {
    fs.mkdirSync(__dirname + '/logs', { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
};
log(`boot pid=${process.pid} node=${process.version} cwd=${process.cwd()} PORT=${process.env.PORT || '-'}`);
process.on('uncaughtException', (e) => log(`uncaughtException: ${(e && e.stack) || e}`));
process.on('unhandledRejection', (e) => log(`unhandledRejection: ${(e && e.stack) || e}`));
try {
  require('./dist/server.cjs');
} catch (err) {
  // Passenger's own log isn't readable on shared hosting: keep the reason next to the app.
  log(`startup failed: ${(err && err.stack) || err}`);
  throw err;
}
JS

cat > "$OUT/package.json" <<'JSON'
{ "name": "replyra-api", "private": true, "type": "commonjs", "engines": { "node": ">=22" } }
JSON

du -sh "$OUT/dist"/*.cjs | sed 's#'"$OUT"'/##'
echo "✓ release ready in apps/server/$OUT"
