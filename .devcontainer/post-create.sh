#!/usr/bin/env bash

set -o errexit

cd "$(dirname "${BASH_SOURCE[0]}")/.."

sudo chown "$(id -u):$(id -g)" node_modules "${HOME}/.local" "${HOME}/.local/share" \
  "${HOME}/.local/share/mise" "${HOME}/.local/share/pnpm"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

./install.sh mise

export PATH="${INSTALL_BIN_DIR}:${HOME}/.local/share/mise/shims:${PATH}"

mise install
mise exec -- vp install --frozen-lockfile
mise exec -- vp exec playwright install-deps chromium
mise exec -- vp exec playwright install chromium

echo ""
echo "✅ Dev container ready. Start docker compose on the host for Postgres/OTel."
