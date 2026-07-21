#!/usr/bin/env bash
# Thin Cursor adapter → shared check-gate hook.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.agents/hooks/check-gate.sh"
