#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

server="$(ls -t "${HOME}"/.antigravity-ide-server/bin/*/bin/antigravity-ide-server 2>/dev/null | head -n 1 || true)"

if [[ -z "${server}" ]]; then
  exit 0
fi

function installedExtensions() {
  "${server}" --list-extensions 2>/dev/null | grep -E '^[^.[:space:]]+\.[^[:space:]]+$' | tr '[:upper:]' '[:lower:]' || true
}

stateDir="${HOME}/.cache/devcontainer"
unavailable="${stateDir}/extensions-unavailable"
mkdir -p "${stateDir}"
touch "${unavailable}"

mapfile -t wanted < <(jq -r '.customizations.vscode.extensions[]?' .devcontainer/devcontainer.json)
installed="$(installedExtensions)"

missing=()
for extension in "${wanted[@]}"; do
  id="$(tr '[:upper:]' '[:lower:]' <<< "${extension}")"
  if ! grep -Fxq "${id}" <<< "${installed}" && ! grep -Fxq "${id}" "${unavailable}"; then
    missing+=("${extension}")
  fi
done

if [[ ${#missing[@]} -eq 0 ]]; then
  echo "Antigravity extensions already installed."
  exit 0
fi

echo "Installing Antigravity extensions: ${missing[*]}"
installArgs=()
for extension in "${missing[@]}"; do
  installArgs+=(--install-extension "${extension}")
done
"${server}" "${installArgs[@]}" > /dev/null 2>&1 || true

installed="$(installedExtensions)"
added=0
for extension in "${missing[@]}"; do
  id="$(tr '[:upper:]' '[:lower:]' <<< "${extension}")"
  if grep -Fxq "${id}" <<< "${installed}"; then
    echo "  installed: ${extension}"
    added=1
  else
    echo "  not on Open VSX, skipped: ${extension}"
    echo "${id}" >> "${unavailable}"
  fi
done

if [[ ${added} -eq 1 ]]; then
  echo "Reload the window (Developer: Reload Window) to activate new extensions."
fi
