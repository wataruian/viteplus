#!/usr/bin/env bash

tools="${1:-"false"}"
ai="${2:-"false"}"

if [[ "${tools}" == "true" ]]; then
  vp run --no-cache clean:tools
fi

if [[ "${ai}" == "true" ]]; then
  vp run --no-cache clean:ai
fi

vp run --no-cache clean:build

echo ""
echo "✅ All good!"
