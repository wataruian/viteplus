#!/usr/bin/env bash

set -o errexit # Bail out on any error

executingDir=$(pwd)
currentDir=$(cd -P -- "$(dirname -- "${0}")" && pwd -P)
scriptDir=$(cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd)

cache="${1:-"true"}"
autogen="${2:-"true"}"
install="${3:-"false"}"
debug="${4:-"false"}"

if [[ "${install}" == "true" ]]; then
  vp install
fi

if [[ "${cache}" == "false" ]]; then
  vp cache clean
fi

vp check
vp run ready

if [[ "${autogen}" == "true" ]]; then
  autogenSuccess="false"
  if autogenOutput="$(vp run -r autogen true 2>&1)"; then
    autogenSuccess="true"
  fi

  if [[ "${debug}" == "true" ]]; then
    echo "${autogenOutput}"
  fi

  if [[ "${autogenSuccess}" == "true" ]]; then
    autogenOutputFile="${scriptDir}/outputs/autogen-output.txt"
    echo "${autogenOutput}" > "${autogenOutputFile}"
    echo "✅ Updated ${autogenOutputFile}"

    openApiGeneratedJsonFile="${scriptDir}/apps/backend/tmp/autogen/openapi.json"
    openApiMasterJsonFile="${scriptDir}/outputs/openapi-spec.json"
    cp "${openApiGeneratedJsonFile}" "${openApiMasterJsonFile}"
    vp fmt --write "${openApiMasterJsonFile}"
    echo "✅ Updated ${openApiMasterJsonFile}"
  else
    echo "❌ Failed running autogen"
    exit 1
  fi
fi
