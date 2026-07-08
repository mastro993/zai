# Zai

Personal finance desktop app built with Tauri (Rust backend + React frontend).

## Package Manager

`pnpm`

## General guardrails

- Keep it simple: we are not trying to impress nobody. Prefer simpler flows and
  clear UIs over complicated UX.
- Avoid unnecessary comments in code. Add a comment only to explain non-obvious
  rationale, such as difficult logic, magic numbers, or hardcoded strings.
  Treat comments as a code smell by default.
- Investigate problems to the root cause and fix them. Never cover up, ignore,
  or hide a problem just to make it disappear.
- Max 400 LOC files. Break them into multiple files when they become too big

## Project structure

```json
apps/frontend/src/
├── routes/               # TanStack file-based route pages
├── components/           # Shared components
│   └── ui/               # Shadcn components (do not touch)
├── features/             # Self-contained feature modules
│   └── <feature>/
│       ├── types/        # Zod schemas and inferred types
│       └── commands/     # Feature-specific command wrappers
├── commands/             # Shared invokeCommand plumbing
├── lib/                  # Primitives and utilities
└── types/                # Shared types

apps/tauri/src/
└── commands/             # Tauri IPC commands

crates/
├── core/                 # Business logic, models, services
└── db/                   # Diesel ORM, repositories, migrations
```

See `apps/frontend/AGENTS.md` for frontend-specific conventions.

## Agent Playbook

### Adding a feature with backend data

1. **Frontend route/UI** → `apps/frontend/src/routes/`
2. **Command wrapper** → `apps/frontend/src/commands/` or
   `features/<feature>/commands/`
3. **Tauri command** → `apps/tauri/src/commands/*.rs`, wire in `mod.rs` +
   `lib.rs`
4. **Core logic** → `crates/core/` services/repos
5. **DB** → `crates/db/` repositories, migrations in `crates/db/migrations`
6. **Tests** → Vitest for TS, `#[test]` for Rust

Web server (`apps/server/`, `RUN_ENV` branching) is deferred—not in the repo
today.

### UI patterns

- Components: `shadcn` and `@base-ui/react`
- Forms: `react-hook-form` + `zod` schemas from
  `apps/frontend/src/features/<feature>/types/`
- Theme: tokens in `apps/frontend/src/styles.css`

### Architecture pattern

```json
Frontend command wrapper → invokeCommand → Tauri IPC
                ↓
            crates/core (business logic)
                ↓
            crates/db (repository)
```

---

## Conventions

### TypeScript

- Strict mode, no unused locals/params
- Prefer interfaces over types, avoid enums
- Functional components, named exports
- Directory names: lowercase-with-dashes
- Never `throw/try/catch`. Use `R.succeed()` / `R.fail()` from `@praha/byethrow`

### Rust

- Idiomatic Rust, small focused functions
- `Result`/`Option`, propagate with `?`, `thiserror` for domain errors
- Keep Tauri commands thin—delegate to `crates/core`
- Migrations in `crates/db/migrations`

### Security

- All data local (SQLite), no cloud
- Secrets via OS keyring—never disk/localStorage
- Never log secrets or financial data

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues, and external PRs are also a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use single-context domain docs. See `docs/agents/domain.md`.
