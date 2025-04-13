#!/bin/bash

# Detect OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  # Windows
  echo "Detected Windows OS"
  npx kill-port 3003
  npm run dev
else
  # Linux/Mac
  echo "Detected Linux/Mac OS"
  fuser -k 3003/tcp || true
  npm run dev
fi 