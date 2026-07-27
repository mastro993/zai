#!/usr/bin/env bash
# Shared after-edit format + lint autofix for Cursor, Claude Code, and Codex.
# Runs on every file edit. Unfixed lint diagnostics must not fail this hook —
# stop/check-gate enforces a clean tree when check-relevant code changed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

cat > /dev/null

pnpm format
# Frontend only: oxlint --fix. Remaining issues are fail-open here.
pnpm lint:fix || true
