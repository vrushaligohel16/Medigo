#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "node_modules not found — installing dependencies..."
  npm install
fi

exec npx nodemon server.js
