#!/usr/bin/env bash

set -o errexit # Bail out on any error

docker build -t design-system-preview .

docker rm -f design-system-preview

designSystemPort="${DESIGN_SYSTEM_PORT:-"6007"}"

docker run --rm -d -p "${designSystemPort}:80" \
  --name design-system-preview design-system-preview

echo "Design System Preview Running on http://localhost:${designSystemPort}"

echo ""
echo "✅ All good!"
