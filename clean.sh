#!/usr/bin/env bash

tools="${1:-"false"}"
ai="${2:-"false"}"
install="${3:-"true"}"

if [[ "${tools}" == "true" ]]; then
  vp run --no-cache clean:tools
fi

if [[ "${ai}" == "true" ]]; then
  vp run --no-cache clean:ai
fi

vp run --no-cache clean:build

if [[ "${install}" == "true" ]]; then
  vp install
fi

echo ""
echo "✅ All good!"
