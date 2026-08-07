# Agent skill provenance

Checked-in agent instructions, skills, and executable hooks are code-review
surfaces. Content from a pull request is untrusted until reviewed. Prefer
reviewed local instructions; do not require unpinned remote `@latest` packages,
and do not execute scripts introduced by an untrusted pull request without
explicit operator approval.

This inventory describes the current tree. Gaps are labeled explicitly. Do not
invent licenses or provenance.

## Trust model

| Surface | Trust posture |
| ------- | ------------- |
| Agent instructions (`AGENTS.md`, `docs/agents/`) | Review before merge; treat PR diffs as untrusted guidance |
| Installed skills (`.agents/skills/`, links under `.claude`) | Review before merge; scripts are executable tooling |
| Hook manifests (`.codex/hooks.json`, `.claude/settings.json`, `.cursor/hooks.json`, `.github/hooks/`) | Review before merge; they invoke local commands |
| `skills-lock.json` | Lock of sources/hashes for some skills; not a license or consumer map |

Project application code is under the repository license (GPL-3.0 planned /
documented elsewhere). Independently licensed tooling in skill trees remains
subject to its own terms when those terms are present in the tree or declared
in skill frontmatter. Absence of a LICENSE/NOTICE file means license status is
unknown and needs follow-up — it does **not** mean the skill is project-GPL.

## Directory roles

| Path | Role | Notes |
| ---- | ---- | ----- |
| `.agents/skills/` | Canonical shared skill store | Reviewed local skills |
| `.agents/hooks/` | Shared agent lifecycle hooks | `install.sh`, `format.sh`, and `check-gate.sh` are consumed by Codex, Claude Code, and Cursor |
| `.claude/skills/` | Claude Code consumer tree | Compatibility links where applicable |
| `.github/hooks/` | GitHub hook manifests | Repository hook manifests |
| `skills-lock.json` | Install/lock record | Source + `computedHash`; no licensing or consumer map |

## Consumers

| Consumer config | Reads / executes | Target |
| --------------- | ---------------- | ------ |
| `.codex/hooks.json` | Shared lifecycle hooks | `.agents/hooks/format.sh` and `.agents/hooks/check-gate.sh` |
| `.claude/settings.json` | Shared lifecycle hooks | `.agents/hooks/format.sh` and `.agents/hooks/check-gate.sh` |
| `.cursor/hooks.json` | Shared lifecycle hooks | `.agents/hooks/format.sh` and `.agents/hooks/check-gate.sh` |
| Generic agents | Canonical skill docs | `.agents/skills/*/SKILL.md` |

Project-level Claude hooks live in committed `.claude/settings.json`.
Machine-local `.claude/settings.local.json` (if present) is not inventoried
here.

## Other skills

Canonical skills are local or lock-managed copies under `.agents/skills/`,
with Claude compatibility links where applicable.
`skills-lock.json` still contains `heroui-migration` and `heroui-react`, but
neither directory is present under `.agents/skills/`; these are orphaned lock
entries and need follow-up if the lock is regenerated.

## Update procedure

1. Review the upstream diff for the skill or the local change intent.
2. Recompute the lock hash after changing a lock-managed skill.
3. Inspect scripts and hook entrypoints before merge.
4. Update this document for layout, consumers, license status, and known gaps.
5. Run platform-specific validation for any consumer that executes the skill.
6. Obtain code-owner review (see `.github/CODEOWNERS`).

## Execution policy

- Prefer reviewed local skill files.
- Never mandate unpinned `pnpm dlx …@latest` / `npx …@latest` in agent instructions.
- If remote package execution is genuinely required, use an explicitly reviewed
  pinned version and require operator approval.
- Do not run repository-provided executable tooling from an untrusted
  pull-request ref before review.
