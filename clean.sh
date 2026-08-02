#!/usr/bin/env bash

tools="${1:-"false"}"
ai="${2:-"false"}"

if [[ "${tools}" == "true" ]]; then
  vp run clean:tools
fi

if [[ "${ai}" == "true" ]]; then
  vp run clean:ai
fi

vp run clean:build
