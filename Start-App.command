#!/bin/zsh
# Double-click to start MonetizeMind Automations
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "First run — installing (one time, ~1 min)..."
  npm install
fi
open "http://localhost:3090" &
npm run dev
