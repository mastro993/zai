#!/usr/bin/env bash
# Shared stop/completion gate for Cursor, Claude Code, and Codex.
# Runs `pnpm check`. On failure, emits consumer-specific JSON so the agent
# cannot finish until lint, format, type-check, and tests pass.
#
# Cursor:  { "followup_message": "..." }  (non-zero exits are fail-open)
# Claude / Codex: { "decision": "block", "reason": "..." }
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

INPUT="$(cat)"

MODE=compat
if printf '%s' "$INPUT" | jq -e 'has("status")' >/dev/null 2>&1; then
  MODE=cursor
  STATUS="$(printf '%s' "$INPUT" | jq -r '.status // "completed"')"
  if [[ "$STATUS" != "completed" ]]; then
    printf '%s\n' '{}'
    exit 0
  fi
fi

LOOP_COUNT="$(printf '%s' "$INPUT" | jq -r '.loop_count // 0')"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

set +e
pnpm check >"$TMP" 2>&1
CODE=$?
set -e

if [[ "$CODE" -eq 0 ]]; then
  printf '%s\n' '{}'
  exit 0
fi

FAILURE_TAIL="$(tail -n 100 "$TMP" | tr -d '\000')"

jq -n \
  --arg out "$FAILURE_TAIL" \
  --argjson loop "$LOOP_COUNT" \
  --arg mode "$MODE" \
  '
  def reason:
    "Repository checks failed (`pnpm check`). Lint, format, type-check, and tests must all pass before this task is complete.\n\n" +
    "Fix every failure below, then finish again so the stop hook re-runs `pnpm check`.\n\n" +
    "```\n" + $out + "\n```\n\n" +
    "(auto-follow-up #" + (($loop + 1) | tostring) + ")";
  if $mode == "cursor" then
    {followup_message: reason}
  else
    {decision: "block", reason: reason}
  end
  '
exit 0
