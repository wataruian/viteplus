#!/usr/bin/env bash

set -o errexit # Bail out on any error

executingDir=$(pwd)
currentDir=$(cd -P -- "$(dirname -- "${0}")" && pwd -P)
scriptDir=$(cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd)

cache="${1:-"true"}"
debug="${2:-"true"}"
install="${3:-"false"}"

function executeCommand() {
  local arguments=("${@}")

  local outputsDir="${scriptDir}/outputs"
  mkdir -p "${outputsDir}"

  local isAutogenCommand="false"
  local commandOutputFile=""
  local commandName="${arguments[*]}"

  case "${commandName}" in
    "vp check")
      commandOutputFile="root-check.output"
      ;;
    "vp run -r check")
      commandOutputFile="check.output"
      ;;
    "vp run -r format")
      commandOutputFile="format.output"
      ;;
    "vp run -r lint")
      commandOutputFile="lint.output"
      ;;
    "vp run -r type-check")
      commandOutputFile="type-check.output"
      ;;
    "vp run -r build")
      commandOutputFile="build.output"
      ;;
    "vp run -r test")
      commandOutputFile="test.output"
      ;;
    "vp run -r autogen ${debug}")
      isAutogenCommand="true"
      commandOutputFile="autogen.output"
      ;;
  esac

  local commandOutputPath="${outputsDir}/${commandOutputFile}"
  local commandSuccess="false"
  if [[ "${debug}" == "true" ]]; then
    FORCE_COLOR=1 CLICOLOR_FORCE=1 "${arguments[@]}" 2>&1 | tee "${commandOutputPath}"
  else
    FORCE_COLOR=1 CLICOLOR_FORCE=1 "${arguments[@]}" > "${commandOutputPath}" 2>&1
  fi

  local exitStatus="${PIPESTATUS[0]}"
  if [[ "${exitStatus}" -eq 0 ]]; then
    commandSuccess="true"
  fi

  if [[ "${commandSuccess}" == "true" ]]; then
    if [[ "${isAutogenCommand}" == "true" ]]; then
      local routesGeneratedJsonFile="${scriptDir}/apps/backend/tmp/autogen/routes.json"
      local routesMasterJsonFile="${outputsDir}/routes.json"
      
      if [[ -f "${routesGeneratedJsonFile}" ]]; then
        cp "${routesGeneratedJsonFile}" "${routesMasterJsonFile}"
        vp fmt --write "${routesMasterJsonFile}"
        echo "✅ Saved routes to ${routesMasterJsonFile}"
      fi

      local openApiGeneratedJsonFile="${scriptDir}/apps/backend/tmp/autogen/openapi.json"
      local openApiMasterJsonFile="${outputsDir}/openapi.json"
      if [[ -f "${openApiGeneratedJsonFile}" ]]; then
        cp "${openApiGeneratedJsonFile}" "${openApiMasterJsonFile}"
        vp fmt --write "${openApiMasterJsonFile}"
        echo "✅ Saved OpenAPI spec to ${openApiMasterJsonFile}"
      fi
    fi

    echo "✅ Successfully executed command: \`${commandName}\`. Saved output: ${commandOutputPath}"
  else
    echo "❌ Failed to execute command: \`${commandName}\`. Saved output: ${commandOutputPath}"
    exit 1
  fi
}

if [[ "${cache}" == "false" ]]; then
  vp cache clean
fi

if [[ "${install}" == "true" ]]; then
  vp install
fi

executeCommand vp check

executeCommand vp run -r check
executeCommand vp run -r format
executeCommand vp run -r lint
executeCommand vp run -r type-check
executeCommand vp run -r build
executeCommand vp run -r test

executeCommand vp run -r autogen "${debug}"

echo "✅ All commands executed successfully"
