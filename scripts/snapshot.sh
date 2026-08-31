#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DB="${ZAI_SOURCE_DB:-$HOME/.zai/userdata/zai.db}"
SANDBOX_DIR="$ROOT_DIR/.local/userdata"
SANDBOX_DB="$SANDBOX_DIR/zai.db"

[[ -f "$SOURCE_DB" ]] || { echo "Missing source database: $SOURCE_DB" >&2; exit 1; }
mkdir -p "$SANDBOX_DIR"
chmod 700 "$ROOT_DIR/.local" "$SANDBOX_DIR"
rm -f "$SANDBOX_DB"*
SQLITE_SANDBOX_DB=${SANDBOX_DB//\'/\'\'}
sqlite3 -readonly "$SOURCE_DB" "VACUUM INTO '$SQLITE_SANDBOX_DB'"
chmod 600 "$SANDBOX_DB"
[[ "$(sqlite3 -readonly "$SANDBOX_DB" 'PRAGMA quick_check;')" == "ok" ]] || {
  echo "Snapshot integrity check failed: $SANDBOX_DB" >&2
  exit 1
}

printf 'Real-data snapshot ready: %s\n' "$SANDBOX_DIR"
