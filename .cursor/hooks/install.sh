#!/usr/bin/env bash
# Thin Cursor adapter → shared session-start install hook.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.agents/hooks/install.sh"
