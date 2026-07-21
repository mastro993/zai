#!/usr/bin/env bash
# Shared after-edit formatter for Cursor, Claude Code, and Codex.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

cat > /dev/null

pnpm format
