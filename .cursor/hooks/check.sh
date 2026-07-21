#!/usr/bin/env bash
# Cursor stop hook: gate agent completion on `pnpm check`.
# On failure, exit 0 with followup_message so Cursor auto-continues the agent
# (non-zero exits are fail-open and would not block completion).
set -euo pipefail

INPUT="$(cat)"
STATUS="$(printf '%s' "$INPUT" | jq -r '.status // "completed"')"
LOOP_COUNT="$(printf '%s' "$INPUT" | jq -r '.loop_count // 0')"

if [[ "$STATUS" != "completed" ]]; then
  printf '%s\n' '{}'
  exit 0
fi

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

# Keep the follow-up prompt bounded; agents see the full log via re-running checks.
FAILURE_TAIL="$(tail -n 100 "$TMP" | tr -d '\000')"

jq -n \
  --arg out "$FAILURE_TAIL" \
  --argjson loop "$LOOP_COUNT" \
  '{
    followup_message: (
      "Repository checks failed (`pnpm check`). Lint, format, type-check, and tests must all pass before this task is complete.\n\n" +
      "Fix every failure below, then finish again so this stop hook re-runs `pnpm check`.\n\n" +
      "```\n" + $out + "\n```\n\n" +
      "(auto-follow-up #" + (($loop + 1) | tostring) + ")"
    )
  }'
exit 0
