#!/usr/bin/env bash
# setup.sh — curl | bash alternative for users without Node/npx
# Usage: curl -fsSL https://raw.githubusercontent.com/MC-Meesh/llm-wiki/main/setup.sh | bash

set -euo pipefail

REPO="MC-Meesh/llm-wiki"
INSTALL_DIR="${INSTALL_DIR:-./llm-wiki}"
PORT="${PORT:-3000}"

echo ""
echo "🌿 llm-wiki setup"
echo ""

# Dependency check
for cmd in git curl node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not found. Install it and re-run."
    exit 1
  fi
done

# Clone app
if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "Cloning llm-wiki into $INSTALL_DIR..."
  git clone "https://github.com/$REPO.git" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# Run the interactive setup CLI
node bin/create-llm-wiki.js
