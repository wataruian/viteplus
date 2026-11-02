#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

stateDir="${HOME}/.cache/devcontainer"
stamp="${stateDir}/post-create.done"

mkdir -p "${stateDir}"
exec 9>"${stateDir}/post-create.lock"
flock 9

if [[ -f "${stamp}" ]]; then
  echo "Dev container already set up (remove ${stamp} to redo it)."
else
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

  touch "${stamp}"
fi

bash .devcontainer/install-extensions.sh

echo ""
echo "✅ Dev container ready. Start docker compose on the host for Postgres/OTel."
