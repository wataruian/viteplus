#!/usr/bin/env bash

set -o errexit # Bail out on any error

docker build -t frontend-preview .

docker rm -f frontend-preview

adminPort="${ADMIN_PORT:-"3001"}"

docker run --rm -d -p "${adminPort}:80" \
  --name frontend-preview frontend-preview

echo "Frontend Preview Running on http://localhost:${adminPort}"

echo ""
echo "✅ All good!"
