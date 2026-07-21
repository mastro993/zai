#!/usr/bin/env bash
# Shared session-start dependency sync for Cursor, Claude Code, and Codex.
# Frozen lockfile; skip lifecycle scripts (no prepare/lefthook side effects).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

cat > /dev/null

pnpm install --frozen-lockfile --ignore-scripts
