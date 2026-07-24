#!/usr/bin/env bash

# set -o errexit # Bail out on any error

executingDir=$(pwd)
currentDir=$(cd -P -- "$(dirname -- "${0}")" && pwd -P)
scriptDir=$(cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd)

tmpLocalBinDir="${scriptDir}/tmp/.local/bin"

pathString="export PATH=\"${tmpLocalBinDir}:\${PATH}\""

rcFiles=(
  "${HOME}/.zshrc"
  "${HOME}/.zshenv"
  "${HOME}/.zprofile"
  "${HOME}/.bashrc"
  "${HOME}/.bash_profile"
)

function updatePath() {
  for rcFile in "${rcFiles[@]}"; do
    touch "${rcFile}"

    if ! grep -Fxq "${pathString}" "${rcFile}"; then
      printf '\n%s\n' "${pathString}" >> "${rcFile}"
    fi

    source "${rcFile}"
  done
}

function installMise() {
  export MISE_INSTALL_PATH="${tmpLocalBinDir}/mise"
  export MISE_VERSION="v2026.7.3"

  curl "https://mise.run" | sh

  updatePath

  mise --version

  mise install

  mise bootstrap mise-shell-activate apply
  mise bootstrap mise-shell-activate status

  echo "PATH updated. Run one of the following to reload your shell:"
  echo "source ~/.bashrc"
  echo "source ~/.zshrc"
  echo "or simply open a new terminal."
}

function installVp() {
  export VP_HOME="${tmpLocalBinDir}/vp"
  export VP_VERSION="0.2.4"

  curl -fsSL "https://vite.plus" | bash

  updatePath

  vp --version
}

binary="${1:-"all"}"

if [[ "${binary}" != "mise" && "${binary}" != "vp" && "${binary}" != "all" ]]; then
  echo "Usage: ./install.sh [mise|vp|all]"
  exit 1
fi

mkdir -p "${tmpLocalBinDir}"

export PATH="${tmpLocalBinDir}:${PATH}"

if [[ "${binary}" == "mise" ]]; then
  installMise
elif [[ "${binary}" == "vp" ]]; then
  installVp
elif [[ "${binary}" == "all" ]]; then
  installMise
  installVp
fi

echo ""
echo "✅ All good!"
