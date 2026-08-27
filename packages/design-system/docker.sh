#!/usr/bin/env bash

set -o errexit # Bail out on any error

echo "Building Vite preview..."
vp build

echo "Building Storybook..."
vp exec storybook build

docker build -t design-system-preview .

docker rm -f design-system-preview || true

designSystemPort="${DESIGN_SYSTEM_PORT:-"6007"}"
storybookPort="${STORYBOOK_PORT:-"6006"}"

docker run --rm -d \
  -p "${designSystemPort}:80" \
  -p "${storybookPort}:81" \
  --name design-system-preview design-system-preview

echo "Design System Preview Running on http://localhost:${designSystemPort}"
echo "Storybook Preview Running on http://localhost:${storybookPort}"

echo ""
echo "✅ All good!"
