# Agent skill provenance

Checked-in agent instructions, skills, and executable hooks are code-review
surfaces. Content from a pull request is untrusted until reviewed. Prefer
reviewed local instructions; do not require unpinned remote `@latest` packages,
and do not execute scripts introduced by an untrusted PR without explicit
operator approval.

This document records what was verified in-tree. Gaps are labeled explicitly.
Do not invent licenses or provenance. Do not consolidate skill trees until
platform-specific consumers are tested.

## Trust model

| Surface | Trust posture |
| ------- | ------------- |
| Agent instructions (`AGENTS.md`, `docs/agents/`) | Review before merge; treat PR diffs as untrusted guidance |
| Vendored skills (`.agents/skills/`, copies under `.claude/` / `.github/`) | Review before merge; scripts are executable tooling |
| Hook manifests (`.codex/hooks.json`, `.cursor/hooks.json`, `.github/hooks/`) | Review before merge; they invoke local commands |
| `skills-lock.json` | Lock of sources/hashes for some skills; not a license or consumer map |

Project application code is under the repository license (GPL-3.0 planned /
documented elsewhere). Independently licensed tooling in skill trees remains
subject to its own terms when those terms are present in the tree or declared
in skill frontmatter. Absence of a LICENSE/NOTICE file means license status is
unknown and needs follow-up — it does **not** mean the skill is project-GPL.

## Directory roles

| Path | Role | Notes |
| ---- | ---- | ----- |
| `.agents/skills/` | Canonical shared skill store (real directories) | Primary copy for most skills; Codex Impeccable hook points here |
| `.agents/hooks/` | Shared agent lifecycle hooks | `install.sh` + `format.sh` (format + lint autofix) + `check-gate.sh` used by Cursor, Claude Code, and Codex |
| `.claude/skills/` | Claude Code consumer tree | Most entries symlink into `.agents/skills/`; `byethrow` and `impeccable` are real copies |
| `.claude/settings.json` | Claude Code project settings | Committed SessionStart / Stop / PostToolUse hooks → `.agents/hooks/` |
| `.codex/` | Codex consumer config | `hooks.json` runs Impeccable + shared install/format/check-gate hooks |
| `.cursor/` | Cursor consumer config | `hooks.json` runs shared install on sessionStart, format on edit, check-gate on stop |
| `.github/skills/` | GitHub Copilot / shared skill copy | Currently only `impeccable` (real copy) |
| `.github/hooks/` | GitHub Copilot hook manifests | `impeccable.json` runs hook under `.github/skills/` |
| `skills-lock.json` | Install/lock record | Source + `computedHash` for a subset of skills; no licensing or consumers |
| `docs/agents/` | Project agent policy docs | Includes this provenance document |

## Consumers

| Consumer config | Reads / executes | Target |
| --------------- | ---------------- | ------ |
| `.codex/hooks.json` | Impeccable + `.agents/hooks/{install,format,check-gate}.sh` | SessionStart install; PostToolUse format+lint autofix/UI check; Stop → `pnpm check` when check-relevant (`decision: block`) |
| `.claude/settings.json` | `.agents/hooks/{install,format,check-gate}.sh` | SessionStart install; PostToolUse format+lint autofix; Stop → `pnpm check` when check-relevant (`decision: block`) |
| `.cursor/hooks.json` | `.agents/hooks/{install,format,check-gate}.sh` | sessionStart install (IDE only); afterFileEdit format+lint autofix; stop → `pnpm check` when check-relevant (`followup_message`) |
| `.github/hooks/impeccable.json` | `node "$(git rev-parse --show-toplevel)/.github/skills/impeccable/scripts/hook.mjs"` | GitHub Impeccable tree |
| Claude Code | `.claude/skills/*` | Symlinks to `.agents/skills/*` except real copies of `byethrow` and `impeccable` |
| Agents / generic | `.agents/skills/*/SKILL.md` | Canonical skill docs; Impeccable scripts under `.agents/skills/impeccable/scripts/` |

Project-level Claude hooks live in committed `.claude/settings.json`. Machine-local
`.claude/settings.local.json` (if present) is not inventoried here.

## Symlinks (verified)

From `.claude/skills/` → `../../.agents/skills/<name>`:

- `improve`, `react-hook-form`, `rust-async-patterns`, `rust-best-practices`,
  `shadcn`, `tanstack-router`, `tauri-v2`, `vercel-react-best-practices`, `zod`

Real copies (not symlinks):

- `.claude/skills/byethrow` (differs from `.agents/skills/byethrow`)
- `.claude/skills/impeccable` (differs from `.agents` and `.github` trees)
- `.github/skills/impeccable` (differs from `.agents` and `.claude` trees)

## Executable tooling (verified)

- Cursor / Claude / Codex shared hooks under `.agents/hooks/` are mode `+x`:
  - `install.sh` runs `pnpm install --frozen-lockfile --ignore-scripts` on
    session start (Cursor `sessionStart`; Claude/Codex `SessionStart` with
    matcher `startup|resume`). Skips lifecycle scripts so `prepare`/lefthook
    do not run. Cursor Cloud does not fire `sessionStart` (documented Cursor
    limitation); cloud agents rely on their environment install step instead.
  - `format.sh` runs `pnpm format` then `pnpm lint:fix` after every edit.
    Lint autofix is fail-open (unfixed diagnostics do not fail the edit hook).
  - `check-gate.sh` runs `pnpm check` on stop/completion only when the branch
    has check-relevant code changes (`apps/`, `crates/`, lockfiles, toolchains).
    Docs, markdown, agent hooks, and scripts alone do not trigger the gate.
    On failure it exits 0 with consumer-specific JSON so the agent must continue:
    - Cursor: `{ "followup_message": "..." }` (non-zero hook exits are fail-open)
    - Claude Code / Codex: `{ "decision": "block", "reason": "..." }`
  - `.cursor/hooks/{install,format,check}.sh` are thin `exec` wrappers to the shared scripts
- Impeccable ships many `.mjs`/`.js` scripts under each copy’s `scripts/`
  directory (on the order of ~66 script files per tree). Hook entrypoints:
  - `.agents/skills/impeccable/scripts/hook.mjs` (Codex)
  - `.github/skills/impeccable/scripts/hook.mjs` (GitHub Copilot)

## Provenance table

Pin revision is not recorded in `skills-lock.json` (only `source`,
`sourceType`, optional `skillPath`, and `computedHash`). “Last update” below is
not per-skill; skill trees were last touched in recent agent-tooling commits
(see git history) — treat dates as unknown unless noted.

| Skill | Layout | Lock entry | Source (lock or header) | Hash (lock) | License | Local mods / notes |
| ----- | ------ | ---------- | ----------------------- | ----------- | ------- | ------------------ |
| `byethrow` | Real copy in `.agents` and `.claude` (not identical) | none | Unknown / local; skill describes `@praha/byethrow` docs | — | not present in tree (unknown — needs follow-up); no frontmatter `license` | Not in lock; no scripts |
| `impeccable` | Three real copies: `.agents`, `.claude`, `.github` (trees differ) | none | Unknown / local; SKILL header `version: 3.9.1` (agents tree) | — | not present in tree (unknown — needs follow-up); no frontmatter `license` | Executable scripts; platform path prefixes differ; **do not consolidate** |
| `improve` | Canonical in `.agents`; `.claude` symlink | yes | `shadcn/improve` (github), `skills/improve/SKILL.md` | `39a93587…9928c13` | Frontmatter `license: MIT`; LICENSE file not present in tree (unknown completeness — needs follow-up) | Docs/skill only |
| `react-hook-form` | Canonical in `.agents`; `.claude` symlink | yes | `pproenca/dot-skills` (github), curated path | `708cdc15…68ba2409` | not present in tree (unknown — needs follow-up) | Docs/skill only |
| `rust-async-patterns` | Canonical in `.agents`; `.claude` symlink | yes | `wshobson/agents` (github) | `20d32ef5…eda389273` | not present in tree (unknown — needs follow-up) | Docs/skill only |
| `rust-best-practices` | Canonical in `.agents`; `.claude` symlink | yes | `apollographql/skills` (github) | `fd336f2f…eb4b2e658` | Frontmatter `license: MIT`; LICENSE file not present in tree (unknown completeness — needs follow-up) | Docs/skill only |
| `shadcn` | Canonical in `.agents`; `.claude` symlink | yes | `shadcn/ui` (github) | `d81caa0f…d5c8058e` | not present in tree (unknown — needs follow-up) | Docs/skill only |
| `tanstack-router` | Canonical in `.agents`; `.claude` symlink | yes | `tanstack-skills/tanstack-skills` (github) | `24beccc4…84669ced56` | not present in tree (unknown — needs follow-up) | Single `SKILL.md`; preferred frontend routing guidance |
| `tauri-v2` | Canonical in `.agents`; `.claude` symlink | yes | `nodnarbnitram/claude-code-extensions` (github) | `377c61c4…012777490` | README claims MIT; LICENSE file not present in tree (unknown completeness — needs follow-up) | Docs/skill only |
| `vercel-react-best-practices` | Canonical in `.agents`; `.claude` symlink | yes | `vercel-labs/agent-skills` (github), react-best-practices path | `ca7b0c0c…a2506212` | Frontmatter `license: MIT`; LICENSE file not present in tree (unknown completeness — needs follow-up) | Includes generated `AGENTS.md` |
| `zod` | Canonical in `.agents`; `.claude` symlink | yes | `pproenca/dot-skills` (github), curated path | `c69b5133…37dfd0144` | not present in tree (unknown — needs follow-up) | Docs/skill only |

Lock also lists `heroui-migration` and `heroui-react` with hashes, but those
directories are **not** present under `.agents/skills/` in this inventory
(orphaned lock entries — needs follow-up).

## Update procedure

1. Review the upstream diff for the skill (or local change intent).
2. Pin a revision or recompute the lock hash; update `skills-lock.json` when
   the skill is lock-managed.
3. Inspect any scripts and hook entrypoints before merge.
4. Update this provenance document for layout, consumers, license status, and
   known gaps.
5. Run platform-specific validation for any consumer that executes the skill
   (Codex / Cursor / Claude / GitHub hooks as applicable).
6. Obtain code-owner review (see `.github/CODEOWNERS`).

## Execution policy

- Prefer reviewed local skill files (especially
  `.agents/skills/tanstack-router/SKILL.md` for routing work).
- Never mandate unpinned `pnpm dlx …@latest` / `npx …@latest` in agent
  instructions.
- If remote package execution is genuinely required: use an explicitly
  reviewed pinned version and require operator approval.
- Do not run repository-provided executable tooling from an untrusted
  pull-request ref before review.

## Deferred consolidation

Duplicated Impeccable trees (`.agents/skills/impeccable`,
`.claude/skills/impeccable`, `.github/skills/impeccable`) differ in content and
path prefixes and are wired to different consumers. Treat unification as a
future compatibility investigation, not current cleanup. Do not delete or
merge these trees without platform-specific tests.
