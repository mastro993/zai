# Zai

Personal finance desktop app built with Tauri (Rust backend + React frontend).

## Package Manager

`pnpm`

## General guardrails

- Keep it simple: we are not trying to impress nobody. Prefer simple UI over
  complicated UX.
- Avoid unnecessary comments in code. Add a comment only to explain non-obvious
  rationale, such as difficult logic, magic numbers, or hardcoded strings.
  Treat comments as a code smell by default.
- Investigate problems to the root cause and fix them. Never cover up, ignore,
  or hide a problem just to make it disappear.
- Never `throw/try/catch`. Use `R.succeed()` / `R.fail()` from `@praha/byethrow`

## Project structure

```json
apps/frontend/
├── src/
│   ├── routes/         # Route pages
│   ├── components/     # Shared components
│   ├── features/       # Self-contained feature modules
│   ├── commands/       # Backend call wrappers (Tauri/Web)
│   └── adapters/       # Runtime detection (desktop vs web)

apps/tauri/src/
└── commands/           # Tauri IPC commands

crates/
├── core/               # Business logic, models, services
└── db/                 # Diesel ORM, repositories, migrations
```

## Agent Playbook

### Adding a feature with backend data

1. **Frontend route/UI** → `apps/frontend/src/pages/`,
   `apps/frontend/src/routes.tsx`
2. **Command wrapper** → `apps/frontend/src/commands/<domain>.ts` (follow
   `RUN_ENV` pattern)
3. **Tauri command** → `apps/tauri/src/commands/*.rs`, wire in `mod.rs` +
   `lib.rs`
4. **Web endpoint** → `apps/server/src/api/`, call `crates/core` service
5. **Core logic** → `crates/core/` services/repos
6. **Tests** → Vitest for TS, `#[test]` for Rust

### UI patterns

- Components: `shadcn` and `@base-ui/react`
- Forms: `react-hook-form` + `zod` schemas from
  `apps/frontend/src/lib/schemas.ts`
- Theme: tokens in `apps/frontend/src/globals.css`

### Architecture pattern

```json
Frontend → Adapter (tauri) → Command wrapper
                ↓
            Tauri IPC
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

### Rust

- Idiomatic Rust, small focused functions
- `Result`/`Option`, propagate with `?`, `thiserror` for domain errors
- Keep Tauri/Axum commands thin—delegate to `crates/core`
- Migrations in `crates/storage-sqlite/migrations`

### Security

- All data local (SQLite), no cloud
- Secrets via OS keyring—never disk/localStorage
- Never log secrets or financial data

---
