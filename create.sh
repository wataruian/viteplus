#!/usr/bin/env bash

vp create backend -- backend-template
vp create frontend -- frontend-template
vp create library -- library-template

echo ""
echo "✅ All good!"
