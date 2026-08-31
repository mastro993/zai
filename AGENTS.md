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

## Project structure

```json
apps/
├── frontend/         # Frontend app, Typescript, React, Tanstack Router
├── tauri/            # Tauri IPC commands
└── server/           # Axum HTTP handlers

crates/
├── app/              # Context initialization
├── core/             # Business logic, models, services
└── db/               # Diesel ORM, repositories, migrations
```

See `apps/frontend/AGENTS.md` for frontend-specific conventions.

## Agent Playbook

### Adding a feature with backend data

1. **Frontend route/UI** → `apps/frontend/src/routes/`
2. **Command wrapper** → `apps/frontend/src/commands/` or
   `apps/frontend/src/features/<feature>/commands/`
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
            crates/app (wiring)
                ↓
            crates/core (business logic)
                ↓
            crates/db (repository)
```

### Testing or trying the app

Keep automated tests isolated and deterministic. Before manually testing or
trying the app, copy `~/.zai/userdata/zai.db` into this worktree's local
sandbox. Never run a development process against the source database.

```bash
./scripts/snapshot.sh
ZAI_HOME="$PWD/.local" pnpm dev:web
# or
ZAI_HOME="$PWD/.local" pnpm dev:tauri
```

The script creates `.local/userdata/zai.db` with a consistent SQLite snapshot
and verifies it with `PRAGMA quick_check`. Set `ZAI_SOURCE_DB` only when the
source lives elsewhere. Refresh the snapshot before each data-dependent session.
If snapshot creation or verification fails, stop and report it.

Keep real financial data inside ignored `.local/`. Inspect only values needed
for the requested test. Never commit or publish databases, raw rows, exports,
screenshots, or unredacted financial values. Redact reports.

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

---

## Cursor Cloud specific instructions

Use **web mode** in Cursor Cloud. Desktop Tauri (`pnpm dev:tauri`) needs GTK/WebKit and a local window session; it is not the default here.

### Runtime

- Start with `pnpm dev:web` (the environment `start` script copies `.env.web.example` when `.env.web` is missing).
- Frontend (Vite): `http://127.0.0.1:1420`
- API (Axum `zai-server`): `http://127.0.0.1:3000`
- Health check: `GET http://127.0.0.1:3000/health` → `{"status":"ok"}`
- Zai Home: temporary per run unless `.env.web` sets an absolute `ZAI_HOME`; SQLite lives at `{ZAI_HOME}/userdata/zai.db`

The API binds loopback only. Do not set `ZAI_BIND_ADDR` to a non-loopback address.

### Toolchain

The workspace uses Rust edition 2024, which needs Rust 1.85+. Install the `stable` toolchain with `rustfmt` and `clippy`. System packages match CI: `libsqlite3-dev`, `libssl-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, and `pkg-config`. Install them noninteractively (`DEBIAN_FRONTEND=noninteractive`, `Dpkg::Options::=--force-confold`) so `fuse.conf` prompts do not hang.

`.cursor/environment.json` runs those steps, then `pnpm install --frozen-lockfile --ignore-scripts` and `cargo build -p zai-server`.

### Checks

```sh
curl -sS http://127.0.0.1:3000/health
pnpm --filter frontend test
cargo test -p zai-server
```

`pnpm check:backend` is the full workspace clippy and test suite. Use it before a PR, not as the boot smoke test.
