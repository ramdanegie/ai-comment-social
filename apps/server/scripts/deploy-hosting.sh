#!/usr/bin/env bash
# Build and deploy Replyra to cPanel shared hosting over SSH.
#
#   ./scripts/deploy-hosting.sh            api + web
#   ./scripts/deploy-hosting.sh api        API/worker only
#   ./scripts/deploy-hosting.sh web        web only
#
# Layout on the server (under ~/<BASE_DIR>, default repositories/ai-comment-social):
#   api/         Node app root (Passenger) + cron worker; api/.env lives only on the server
#   api/public/  document root of replyra-api.creativeshine.id
#   web/         document root of replyra.creativeshine.id (static build)
#
# Config: apps/server/.env.deploy (git-ignored): SSH_USER, SSH_HOST, SSH_PORT, BASE_DIR, WEB_API_URL
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env.deploy ]] || { echo "✗ .env.deploy not found" >&2; exit 1; }
set -a; source .env.deploy; set +a
: "${SSH_USER:?}"; : "${SSH_HOST:?}"; SSH_PORT="${SSH_PORT:-22}"
BASE_DIR="${BASE_DIR:-repositories/ai-comment-social}"
WEB_API_URL="${WEB_API_URL:-https://replyra-api.creativeshine.id}"
TARGET="${1:-all}"
SSH=(ssh -p "$SSH_PORT" -o ConnectTimeout=20 "$SSH_USER@$SSH_HOST")
RSYNC=(rsync -az --delete -e "ssh -p $SSH_PORT")

if [[ "$TARGET" == all || "$TARGET" == api ]]; then
  ./scripts/build-node.sh
  echo "▸ API → $SSH_HOST:~/$BASE_DIR/api"
  "${SSH[@]}" "mkdir -p ~/$BASE_DIR/api/public ~/$BASE_DIR/api/tmp ~/$BASE_DIR/api/logs"
  "${RSYNC[@]}" --exclude '.env' --exclude 'tmp/' --exclude 'logs/' --exclude 'public/' --exclude 'node_modules/' \
    --exclude '.htaccess' --exclude 'stderr.log' release/ "$SSH_USER@$SSH_HOST:$BASE_DIR/api/"
  "${SSH[@]}" "set -e; cd ~/$BASE_DIR/api
    NODE=\$(ls -d /opt/alt/alt-nodejs22/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/bin/node 2>/dev/null | head -1)
    test -f .env || { echo '✗ ~/$BASE_DIR/api/.env missing'; exit 1; }
    \$NODE dist/migrate.cjs
    touch tmp/restart.txt
    echo \"✓ API deployed (node: \$NODE)\""
fi

if [[ "$TARGET" == all || "$TARGET" == web ]]; then
  echo "▸ Build web (static, API=$WEB_API_URL)"
  (cd ../web && ADAPTER=static VITE_API_URL="$WEB_API_URL" bunx vite build >/dev/null)
  echo "▸ Web → $SSH_HOST:~/$BASE_DIR/web"
  "${SSH[@]}" "mkdir -p ~/$BASE_DIR/web"
  "${RSYNC[@]}" --exclude '.well-known/' --exclude 'cgi-bin/' ../web/build/ "$SSH_USER@$SSH_HOST:$BASE_DIR/web/"
  echo "✓ web deployed"
fi
