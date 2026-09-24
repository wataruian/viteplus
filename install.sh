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
  export VP_VERSION="0.3.3"

  curl -fsSL "https://vite.plus" | bash

  updatePath

  vp --version
}

function installAntigravity() {
  local AGY_VERSION="1.1.8"
  local AGY_TAR_FILE="${tmpLocalBinDir}/agy.tar.gz"

  # curl -fsSL "https://antigravity.google/cli/install.sh" | bash -s -- \
  #   -d "${tmpLocalBinDir}/agy"

  curl -s -L \
  -o "${AGY_TAR_FILE}" \
  "https://github.com/google-antigravity/antigravity-cli/releases/download/${AGY_VERSION}/agy_cli_mac_arm64.tar.gz"

  tar -xzvf "${AGY_TAR_FILE}" -C "${tmpLocalBinDir}"

  rm -f "${AGY_TAR_FILE}"

  mv "${tmpLocalBinDir}/antigravity" "${tmpLocalBinDir}/agy"

  chmod +x "${tmpLocalBinDir}/agy"

  updatePath

  agy --version
}

binary="${1:-"all"}"

if [[ "${binary}" != "mise" && "${binary}" != "vp" && "${binary}" != "agy" && "${binary}" != "all" ]]; then
  echo "Usage: ./install.sh [mise|vp|agy|all]"
  exit 1
fi

mkdir -p "${tmpLocalBinDir}"

export PATH="${tmpLocalBinDir}:${PATH}"

if [[ "${binary}" == "mise" ]]; then
  installMise
elif [[ "${binary}" == "vp" ]]; then
  installVp
elif [[ "${binary}" == "agy" ]]; then
  installAntigravity
elif [[ "${binary}" == "all" ]]; then
  installMise
  installVp
  installAntigravity
fi

echo ""
echo "✅ All good!"
