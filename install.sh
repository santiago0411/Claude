#!/usr/bin/env sh
# lean-kit installer for macOS and Linux. Usage: ./install.sh [--dry-run] [--codex] [--statusline] [--uninstall]
set -e
command -v node >/dev/null 2>&1 || { echo "Node.js 18 or newer is required: https://nodejs.org" >&2; exit 1; }
exec node "$(dirname "$0")/install.mjs" "$@"
