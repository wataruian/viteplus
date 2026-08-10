#!/usr/bin/env bash

mode="${1:-"dev"}"

if [[ "${mode}" != "dev" && "${mode}" != "prod" ]]; then
  echo "Invalid mode: ${mode}"
  exit 1
fi

echo "Mode: ${mode}"
vp run "serve:${mode}"
