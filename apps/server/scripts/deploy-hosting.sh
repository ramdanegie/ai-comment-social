#!/usr/bin/env bash
# Build the Node release and deploy it to cPanel shared hosting over SSH.
#
#   ./scripts/deploy-hosting.sh            build + upload + migrate + restart
#   ./scripts/deploy-hosting.sh --no-build upload the existing release/
#
# Config: apps/server/.env.deploy (git-ignored)
#   SSH_USER=…  SSH_HOST=…  SSH_PORT=…  REMOTE_DIR=replyra-api
# The server keeps its own <REMOTE_DIR>/.env (never uploaded or deleted by this script).
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env.deploy ]] || { echo "✗ .env.deploy not found (SSH_USER, SSH_HOST, SSH_PORT, REMOTE_DIR)" >&2; exit 1; }
set -a; source .env.deploy; set +a
: "${SSH_USER:?}"; : "${SSH_HOST:?}"; SSH_PORT="${SSH_PORT:-22}"; REMOTE_DIR="${REMOTE_DIR:-replyra-api}"
SSH=(ssh -p "$SSH_PORT" -o ConnectTimeout=20 "$SSH_USER@$SSH_HOST")

[[ "${1:-}" == "--no-build" ]] || ./scripts/build-node.sh

echo "▸ Upload release/ → $SSH_HOST:~/$REMOTE_DIR"
rsync -az --delete \
  --exclude '.env' --exclude 'tmp/' --exclude 'logs/' --exclude 'node_modules/' --exclude 'stderr.log' \
  -e "ssh -p $SSH_PORT" release/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"

echo "▸ Migrate + restart"
"${SSH[@]}" "set -e; cd ~/$REMOTE_DIR
  NODE=\$(ls -d /opt/alt/alt-nodejs22/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/bin/node 2>/dev/null | head -1)
  test -f .env || { echo '✗ ~/$REMOTE_DIR/.env missing'; exit 1; }
  \$NODE dist/migrate.cjs
  mkdir -p tmp logs && touch tmp/restart.txt
  echo \"✓ deployed (node: \$NODE)\""
