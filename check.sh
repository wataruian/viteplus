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

  local isCompileCommand="false"
  local isAutogenCommand="false"
  local commandOutputFile=""
  local commandName="${arguments[*]}"

  case "${commandName}" in
    "vp run -r root")
      commandOutputFile="root.output"
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
    "vp run -r compile"*)
      isCompileCommand="true"
      commandOutputFile="compile.output"
      ;;
    "vp run -r autogen"*)
      isAutogenCommand="true"
      commandOutputFile="autogen.output"
      ;;
  esac

  local commandOutputPath="${outputsDir}/${commandOutputFile}"
  local commandSuccess="false"
  local exitStatus=""
  
  if [[ "${debug}" == "true" ]]; then
    node -e '
      const { spawn } = require("child_process");
      const fs = require("fs");
      const [outputFile, cmd, ...args] = process.argv.slice(1);
      const outFd = fs.openSync(outputFile, "w");
      const child = spawn(cmd, args, {
        env: { ...process.env, FORCE_COLOR: "1", CLICOLOR_FORCE: "1" },
        stdio: ["inherit", outFd, outFd]
      });
      let readOffset = 0;
      const readFd = fs.openSync(outputFile, "r");
      const buffer = Buffer.alloc(65536);
      function streamOutput() {
        try {
          const bytesRead = fs.readSync(readFd, buffer, 0, buffer.length, readOffset);
          if (bytesRead > 0) {
            process.stdout.write(buffer.subarray(0, bytesRead));
            readOffset += bytesRead;
            return true;
          }
        } catch (e) {}
        return false;
      }
      const interval = setInterval(() => {
        while (streamOutput()) {}
      }, 50);
      child.on("close", (code) => {
        clearInterval(interval);
        while (streamOutput()) {}
        fs.closeSync(outFd);
        fs.closeSync(readFd);
        process.exitCode = code === null ? 1 : code;
      });
    ' "${commandOutputPath}" "${arguments[@]}"
    exitStatus="${?}"
  else
    FORCE_COLOR=1 CLICOLOR_FORCE=1 "${arguments[@]}" > "${commandOutputPath}" 2>&1
    exitStatus="${?}"
  fi
  
  if [[ -f "${commandOutputPath}" ]]; then
    node -e 'const fs = require("fs"); const f = process.argv[1]; fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ""));' "${commandOutputPath}"
  fi

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

    if [[ "${isCompileCommand}" == "true" ]]; then
      local stylesGeneratedJsonFile="${scriptDir}/packages/design-system/tmp/compile/styles.json"
      local stylesMasterJsonFile="${outputsDir}/styles.json"
      
      if [[ -f "${stylesGeneratedJsonFile}" ]]; then
        cp "${stylesGeneratedJsonFile}" "${stylesMasterJsonFile}"
        vp fmt --write "${stylesMasterJsonFile}"
        echo "✅ Saved styles to ${stylesMasterJsonFile}"
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

executeCommand vp run -r root

executeCommand vp run -r check
executeCommand vp run -r format
executeCommand vp run -r lint
executeCommand vp run -r type-check
executeCommand vp run -r build
executeCommand vp run -r test

executeCommand vp run -r compile "${debug}"
executeCommand vp run -r autogen "${debug}"

echo ""
echo "✅ Commands executed successfully"
