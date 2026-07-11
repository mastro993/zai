# Zai

Personal finance app built with Tauri and Axum (Rust backend + React frontend).

## Overview

- **Frontend**: React + Vite + Tailwind v4 + shadcn (`apps/frontend/`)
- **Desktop**: Tauri/Rust with SQLite (`apps/tauri/`, `crates/`)
- **Web mode**: Axum HTTP server (`apps/server/`)

## Pillars

Before making any architectural, implementation, or product decision, evaluate
it against these four fundamental pillars. If a solution violates one, reject
it or explicitly justify the trade-off.

- **Secure**: Protect user data at every layer. Store secrets securely, encrypt
  sensitive data when appropriate, validate inputs, and follow the principle of
  least privilege.
- **Reliable**: Zai must always behave predictably and consistently. Data
  integrity, correctness, recoverability, and deterministic behavior take
  priority over convenience.
- **Efficient**: Performance is a core requirement, not an afterthought.
  Optimize for low latency, minimal resource usage, and scalability. The
  architecture should be capable of handling thousands of operations per second
  without fundamental redesign.
- **Private**: User data belongs exclusively to the user. Zai is local-first:
  no cloud services, no telemetry, no remote storage, and no external data
  processing unless the user explicitly requests it.

When in doubt, choose the solution that best satisfies all four pillars. If a
trade-off is unavoidable, state it explicitly.

## Implementation guardrails

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

apps/server/src/
└── api/                  # Axum HTTP handlers

crates/
├── app/                  # Context initialization
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
4. **Web endpoint** → `apps/server/src/api/`, call `crates/core` service
5. **Core logic** → `crates/core/` services/repos
6. **DB** → `crates/db/` repositories, migrations in `crates/db/migrations`
7. **Tests** → Vitest for TS, `#[test]` for Rust

### UI patterns

- Components: always use `shadcn` and `@base-ui/react`
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
- Never `throw/try/catch`. Use `@praha/byethrow`

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
