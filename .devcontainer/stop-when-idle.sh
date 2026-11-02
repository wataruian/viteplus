#!/usr/bin/env bash

set -o nounset
set -o pipefail

pollSeconds=5
graceSeconds=60

stateDir="${HOME}/.cache/devcontainer"
log="${stateDir}/stop-when-idle.log"

mkdir -p "${stateDir}"
exec 8>"${stateDir}/stop-when-idle.lock"
flock --nonblock 8 || exit 0

agyRelay='\.antigravity-ide-server/bin/[^ ]*/node -e .*net\.createConnection'

countOutsideSessions() {
  ps -eo pid=,ppid=,args= | awk '$1 != 1 && $2 == 0' | grep --count --invert-match 'net\.createServer'
}

armed=false
idleSince=0

while sleep "${pollSeconds}"; do
  if [[ "${armed}" == false ]]; then
    if pgrep --full -- "${agyRelay}" >/dev/null; then
      armed=true
      echo "$(date -u +%FT%TZ) Antigravity connected; stopping the container ${graceSeconds}s after it leaves." >>"${log}"
    fi
    continue
  fi

  if (($(countOutsideSessions) > 0)); then
    idleSince=0
    continue
  fi

  now="$(date +%s)"
  if ((idleSince == 0)); then
    idleSince="${now}"
  fi

  if ((now - idleSince >= graceSeconds)); then
    echo "$(date -u +%FT%TZ) No session left for ${graceSeconds}s; stopping the container." >>"${log}"
    docker stop "$(hostname)" >>"${log}" 2>&1
    exit 0
  fi
done
