#!/usr/bin/env bash
# Thin Cursor adapter → shared format hook.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.agents/hooks/format.sh"
