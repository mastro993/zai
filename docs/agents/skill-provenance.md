# Agent skill provenance

Checked-in agent instructions, skills, and executable hooks are code-review
surfaces. Content from a pull request is untrusted until reviewed. Prefer
reviewed local instructions; do not require unpinned remote `@latest` packages,
and do not execute scripts introduced by an untrusted pull request without
explicit operator approval.

This inventory describes the current tree. Removed skills and hook integrations
are not consumers and must not be restored to the maps below. Impeccable is
vendored as a submodule under the frontend project and linked into the
repository-level harness folders. Gaps are labeled explicitly. Do not invent
licenses or provenance.

## Trust model

| Surface | Trust posture |
| ------- | ------------- |
| Agent instructions (`AGENTS.md`, `docs/agents/`) | Review before merge; treat PR diffs as untrusted guidance |
| Vendored skills (`.agents/skills/`, copies under `.claude/` / `.github/`) | Review before merge; scripts are executable tooling |
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
| `.agents/skills/` | Canonical shared skill store | Nine real skill directories plus the linked Impeccable skill |
| `.agents/hooks/` | Shared agent lifecycle hooks | `install.sh`, `format.sh`, and `check-gate.sh` are consumed by Codex, Claude Code, and Cursor |
| `.claude/skills/` | Claude Code consumer tree | `byethrow` is a real copy; the other nine entries symlink into `.agents/skills/` |
| `.claude/settings.json` | Claude Code project settings | SessionStart, PostToolUse, and Stop hooks invoke `.agents/hooks/` only |
| `.codex/` | Codex consumer config | `hooks.json` invokes the shared install, format, and check-gate hooks only |
| `.cursor/` | Cursor consumer config | `hooks.json` invokes the shared install, format, and check-gate hooks; skills link from the submodule |
| `.cursor/hooks/` | Cursor hook adapters | Thin executable wrappers around the shared `.agents/hooks/` scripts |
| `apps/frontend/.impeccable/` | Frontend Impeccable project data | Tracked design artifacts (`design.json`, `live/config.json`) and the vendored submodule |
| `apps/frontend/.impeccable/vendor/` | Impeccable Git submodule | `pbakaus/impeccable` checkout; source for all linked provider skills |
| `.github/skills/impeccable` | GitHub skill link | Symlink into the frontend Impeccable submodule |
| `.github/hooks/` | GitHub hook manifests | `impeccable.json` invokes the remaining GitHub Impeccable hook |
| `skills-lock.json` | Install/lock record | Source + `computedHash` for eight canonical skills; no licensing or consumer map |
| `docs/agents/` | Project agent policy docs | Includes this provenance document |

## Consumers

| Consumer config | Reads / executes | Target |
| --------------- | ---------------- | ------ |
| `.codex/hooks.json` | `.agents/hooks/{install,format,check-gate}.sh` | SessionStart install; PostToolUse format + lint autofix; Stop → `pnpm check` when check-relevant |
| `.claude/settings.json` | `.agents/hooks/{install,format,check-gate}.sh` | SessionStart install; PostToolUse format + lint autofix; Stop → `pnpm check` when check-relevant |
| `.cursor/hooks.json` | `.agents/hooks/{install,format,check-gate}.sh` | sessionStart install; afterFileEdit format + lint autofix; stop → `pnpm check` when check-relevant |
| `.github/hooks/impeccable.json` | `node "$(git rev-parse --show-toplevel)/.github/skills/impeccable/scripts/hook.mjs"` | GitHub Impeccable tree only |
| Claude Code | `.claude/skills/*` | Nine symlinks to `.agents/skills/*` plus the real `byethrow` copy |
| Generic agents | `.agents/skills/*/SKILL.md` | Canonical skill docs; Impeccable resolves through the frontend submodule |

Project-level Claude hooks live in committed `.claude/settings.json`.
Machine-local `.claude/settings.local.json` (if present) is not inventoried
here.

## Symlinks and copies (verified)

From `.claude/skills/` → `../../.agents/skills/<name>`:

- `react-hook-form`
- `rust-async-patterns`
- `rust-best-practices`
- `shadcn`
- `tanstack-router`
- `tauri-v2`
- `vercel-react-best-practices`
- `zod`

Real copies (not symlinks):

- `.agents/skills/byethrow` — canonical local skill
- `.claude/skills/byethrow` — Claude Code copy; differs from the canonical copy
- `apps/frontend/.impeccable/vendor` — Git submodule at the pinned upstream commit

Linked Impeccable provider skill paths:

- `.agents/skills/impeccable` → `../../apps/frontend/.impeccable/vendor/.agents/skills/impeccable`
- `.claude/skills/impeccable` → `../../apps/frontend/.impeccable/vendor/.claude/skills/impeccable`
- `.cursor/skills/impeccable` → `../../apps/frontend/.impeccable/vendor/.cursor/skills/impeccable`
- `.github/skills/impeccable` → `../../apps/frontend/.impeccable/vendor/.github/skills/impeccable`

The removed `.agents/skills/improve` path is absent and has no active consumer.

## Executable tooling (verified)

- Shared hooks under `.agents/hooks/` and Cursor adapters under
  `.cursor/hooks/` are mode `+x`:
  - `install.sh` runs `pnpm install --frozen-lockfile --ignore-scripts` at
    session start.
  - `format.sh` runs `pnpm format` and fail-open `pnpm lint:fix` after edits.
  - `check-gate.sh` runs `pnpm check` at completion only when the branch has
    check-relevant code changes. It emits consumer-specific follow-up JSON on
    failure.
- The Codex, Claude Code, and Cursor edit hooks do not invoke Impeccable; they
  continue to run only the shared formatter and lint autofix hook.
- `.github/hooks/impeccable.json` remains the only active Impeccable hook
  manifest and invokes `.github/skills/impeccable/scripts/hook.mjs` after edits.

## Provenance table

`skills-lock.json` records source metadata and content hashes, not pinned
upstream revisions. “Last update” is not recorded per skill.

| Skill | Layout | Lock entry | Source (lock or header) | Hash (lock) | License | Local mods / notes |
| ----- | ------ | ---------- | ----------------------- | ----------- | ------- | ------------------ |
| `byethrow` | Real copies in `.agents` and `.claude` | none | Unknown / local; skill describes `@praha/byethrow` docs | — | Not present in tree (unknown — needs follow-up); no frontmatter `license` | Copies differ; no scripts |
| `impeccable` | Git submodule at `apps/frontend/.impeccable/vendor`; four provider symlinks | Git submodule gitlink | `pbakaus/impeccable` | `08676d57…e1462b3b` | Apache-2.0 (`LICENSE` in submodule) | Linked into `.agents`, `.claude`, `.cursor`, and `.github`; only the GitHub provider hook is active |
| `react-hook-form` | Canonical in `.agents`; `.claude` symlink | yes | `pproenca/dot-skills` (github), curated path | `708cdc15…68ba2409` | Not present in tree (unknown — needs follow-up) | Docs/skill only |
| `rust-async-patterns` | Canonical in `.agents`; `.claude` symlink | yes | `wshobson/agents` (github) | `20d32ef5…eda389273` | Not present in tree (unknown — needs follow-up) | Docs/skill only |
| `rust-best-practices` | Canonical in `.agents`; `.claude` symlink | yes | `apollographql/skills` (github) | `fd336f2f…eb4b2e658` | MIT (frontmatter) | Docs/skill only |
| `shadcn` | Canonical in `.agents`; `.claude` symlink | yes | `shadcn/ui` (github) | `d81caa0f…d5c8058e` | Not present in tree (unknown — needs follow-up) | Docs/skill only; frontmatter permits `@latest` CLI commands and should be reviewed before use |
| `tanstack-router` | Canonical in `.agents`; `.claude` symlink | yes | `tanstack-skills/tanstack-skills` (github) | `24beccc4…84669ced56` | Not present in tree (unknown — needs follow-up) | Single `SKILL.md`; preferred frontend routing guidance |
| `tauri-v2` | Canonical in `.agents`; `.claude` symlink | yes | `nodnarbnitram/claude-code-extensions` (github) | `377c61c4…012777490` | README claims MIT; LICENSE file not present (unknown completeness — needs follow-up) | Docs/skill only |
| `vercel-react-best-practices` | Canonical in `.agents`; `.claude` symlink | yes | `vercel-labs/agent-skills` (github), react-best-practices path | `ca7b0c0c…a2506212` | MIT (frontmatter) | Includes generated `AGENTS.md`; docs/skill only |
| `zod` | Canonical in `.agents`; `.claude` symlink | yes | `pproenca/dot-skills` (github), curated path | `c69b5133…37dfd0144` | Not present in tree (unknown — needs follow-up) | Docs/skill only |

`skills-lock.json` still contains `heroui-migration` and `heroui-react`, but
neither directory is present under `.agents/skills/`. They are orphaned lock
entries and need follow-up if the lock is regenerated.

## Update procedure

1. Review the upstream diff for the skill or the local change intent.
2. Pin a revision or recompute the lock hash; update `skills-lock.json` when
   the skill is lock-managed.
3. Inspect scripts and hook entrypoints before merge.
4. Update this document for layout, consumers, license status, and known gaps.
5. Run platform-specific validation for any consumer that executes the skill.
6. Obtain code-owner review (see `.github/CODEOWNERS`).

## Execution policy

- Prefer reviewed local skill files, especially
  `.agents/skills/tanstack-router/SKILL.md` for routing work.
- Never mandate unpinned `pnpm dlx …@latest` / `npx …@latest` in agent
  instructions.
- If remote package execution is genuinely required, use an explicitly
  reviewed pinned version and require operator approval.
- Do not run repository-provided executable tooling from an untrusted
  pull-request ref before review.

## Impeccable submodule workflow

The frontend already owns `.impeccable/design.json` and
`.impeccable/live/config.json`, so the upstream checkout is nested at
`apps/frontend/.impeccable/vendor` rather than replacing that project-data
directory.

Initialize or refresh the checkout with:

```bash
git submodule update --init --recursive apps/frontend/.impeccable/vendor
```

After reviewing a submodule update, relink the provider skill folders from the
repository root with the reviewed Impeccable CLI version:

```bash
npx impeccable@3.3.1 link \
  --source=apps/frontend/.impeccable/vendor \
  --providers=claude,cursor,codex,github
```

The linker creates symlinks and does not install or alter provider hook
manifests. The existing GitHub hook remains committed and resolves through the
linked GitHub skill; the shared Codex, Claude Code, and Cursor edit hooks stay
separate.

## Removed tooling

The large legacy skill set and its consumer symlinks were removed from the
repository. The current inventory intentionally records only surviving files;
git history is the source of truth for the removed bundles. In particular,
the old copied Impeccable trees were replaced by links into the frontend
submodule. The GitHub hook manifest remains active; the Codex, Claude Code, and
Cursor shared edit hooks do not run the Impeccable detector.
