#!/usr/bin/env bash
# Shared stop/completion gate for Cursor, Claude Code, and Codex.
# Runs `pnpm check` only when the current branch has check-relevant code
# changes (apps/, crates/, lockfiles, toolchains). Docs, markdown, agent
# hooks, and scripts do not trigger the gate. On failure, emits
# consumer-specific JSON so the agent cannot finish until lint, format,
# type-check, and tests pass.
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

# Paths that affect `pnpm check` (file-size + frontend + backend).
is_check_relevant_path() {
  local path="${1#./}"
  case "$path" in
    apps/*|crates/*) return 0 ;;
    package.json|pnpm-lock.yaml|pnpm-workspace.yaml) return 0 ;;
    Cargo.toml|Cargo.lock|deny.toml|clippy.toml|lefthook.yml) return 0 ;;
    rust-toolchain|rust-toolchain.toml|rust-toolchain.*) return 0 ;;
    tsconfig.json|tsconfig.*.json) return 0 ;;
    playwright.config.*|vitest.config.*) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_base_ref() {
  if git rev-parse --verify -q origin/HEAD >/dev/null; then
    git rev-parse --abbrev-ref origin/HEAD
  elif git rev-parse --verify -q origin/main >/dev/null; then
    printf '%s\n' origin/main
  elif git rev-parse --verify -q main >/dev/null; then
    printf '%s\n' main
  else
    return 1
  fi
}

# Tracked + untracked working tree, plus commits ahead of default branch.
list_changed_paths() {
  git diff --name-only HEAD 2>/dev/null || true
  git ls-files --others --exclude-standard 2>/dev/null || true

  local base_ref merge_base
  if base_ref="$(resolve_base_ref)"; then
    if merge_base="$(git merge-base HEAD "$base_ref" 2>/dev/null)"; then
      git diff --name-only "$merge_base"...HEAD 2>/dev/null || true
    fi
  fi
}

branch_has_code_changes() {
  local path
  local saw_any=0

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    saw_any=1
    if is_check_relevant_path "$path"; then
      return 0
    fi
  done < <(list_changed_paths | sort -u)

  if [[ "$saw_any" -eq 0 ]]; then
    # No path list and no default branch → fail-open so we never skip blind.
    if ! resolve_base_ref >/dev/null; then
      return 0
    fi
  fi

  return 1
}

if ! branch_has_code_changes; then
  printf '%s\n' '{}'
  exit 0
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
