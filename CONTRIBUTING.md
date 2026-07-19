# Contributing to Zai

Thank you for your interest in contributing. Zai is a local-first personal finance application built with Tauri (desktop), Axum (web mode), React, and Rust.

## Project Status

Zai is unfinished alpha software (`0.0.1-alpha.1`). APIs, data models, and workflows may change without notice. There is no stable public release or long-term support commitment yet.

Every contribution should respect the project pillars:

- **Secure** — protect user data at every layer; validate inputs; follow least privilege.
- **Reliable** — prioritize correctness, data integrity, and predictable behavior.
- **Efficient** — optimize for low latency and minimal resource use.
- **Private** — keep data local; no cloud services, telemetry, or remote processing unless the user explicitly requests it.

## Prerequisites

- [Node.js](https://nodejs.org/) compatible with the repository toolchain
- [pnpm](https://pnpm.io/) `10.33.0` (declared in root `package.json` as `packageManager`)
- [Rust](https://www.rust-lang.org/) toolchain for Tauri and backend crates
- Platform dependencies for [Tauri](https://v2.tauri.app/start/prerequisites/) when working on desktop mode

## Installation

```sh
git clone https://github.com/mastro993/zai-app.git
cd zai-app
pnpm install
```

The `prepare` script runs `pnpm exec lefthook install`, which configures Git hooks for local checks. Run `pnpm install` after cloning so hooks are installed.

## Local Development

**Desktop (Tauri):**

```sh
pnpm dev:tauri
```

**Web (Axum server + frontend):**

```sh
pnpm dev:web
```

Use temporary or synthetic financial data during development. Do not commit real account numbers, statements, exports, credentials, or production databases.

## Architecture

```
Frontend command wrapper → invokeCommand → Tauri IPC / Axum HTTP
  ↓
crates/app (wiring)
  ↓
crates/core (business logic)
  ↓
crates/db (repositories, migrations)
```

- Frontend routes and UI: `apps/frontend/src/routes/`, `apps/frontend/src/features/`
- Tauri commands: `apps/tauri/src/commands/`
- Web handlers: `apps/server/src/api/`
- Core services: `crates/core/`
- Database layer: `crates/db/`

See `AGENTS.md` and `apps/frontend/AGENTS.md` for detailed conventions.

## Before You Code

- **Large product or architecture changes** — open an issue first so scope and trade-offs are agreed before significant work.
- **Domain vocabulary** — use established terms from `docs/agents/domain.md` where applicable.
- **Issue tracker** — see `docs/agents/issue-tracker.md` for triage and labels.

## Coding Rules

- Keep modules focused; prefer files under 400 lines of code.
- Fix root causes; do not paper over bugs.
- Keep Tauri commands and HTTP handlers thin; delegate to `crates/core`.
- Never log secrets or real financial data.
- Store secrets via the OS keyring, not disk or `localStorage`.
- TypeScript: strict mode, `@praha/byethrow` instead of `throw`/`try`/`catch`.
- Rust: propagate errors with `?`, use `thiserror` for domain errors.

## Verification

Before opening a pull request, run:

```sh
pnpm check
pnpm audit
```

When transport or web behavior changes, also run:

```sh
pnpm test:e2e:web
```

## Pull Requests

- Keep changes focused and reviewable.
- Link the related issue when one exists.
- Include test evidence or steps to reproduce the fix.
- Add UI screenshots or recordings when the change is visual.
- Document database migrations and any upgrade steps for existing local data.
- Update documentation when behavior, commands, or setup change.

## Security Reports

Do not file security vulnerabilities as public issues. Follow [SECURITY.md](SECURITY.md) and report privately via GitHub Security Advisories.

## Licensing

By contributing, you agree that your contributions are submitted under the [GNU General Public License v3.0 only](LICENSE) (`GPL-3.0-only`) and that you have the authority to license your work on those terms.
