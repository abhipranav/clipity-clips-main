#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/home/ubuntu/clipity-clips-main}
cd "$APP_DIR"

export PATH="$HOME/.bun/bin:$PATH"

bun install --frozen-lockfile
(
  cd frontend
  bun install --frozen-lockfile
)

bun run build

sudo systemctl restart clipity-worker
sudo systemctl restart clipity-web

sudo systemctl is-active --quiet clipity-worker
sudo systemctl is-active --quiet clipity-web

echo "Deploy complete: web + worker are active"
