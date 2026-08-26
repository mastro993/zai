# Contributing to Zai

Thank you for your interest in Zai. Zai is a local-first personal finance application built with Tauri (desktop), Axum (web mode), React, and Rust.

## Current Contribution Policy

> **Zai is not ready to accept direct contributions. Do not open pull requests.**

The product roadmap and contribution process are not defined yet. For now, external contributions are accepted only as [GitHub issues](https://github.com/mastro993/zai/issues/new/choose) for:

- bug reports;
- feature requests; and
- suggestions.

Opening an issue does not authorize implementation or guarantee that a proposal will be added to the roadmap. Please wait for the contribution policy to change before submitting code, documentation, designs, translations, or other changes directly.

## Project Status

Zai is unfinished software. Release versions remain committed on `main`. APIs, data models, and workflows may change without notice. There is no defined roadmap or long-term support commitment yet.

Every issue or proposal should respect the project pillars:

- **Secure** — protect user data at every layer; validate inputs; follow least privilege.
- **Reliable** — prioritize correctness, data integrity, and predictable behavior.
- **Efficient** — optimize for low latency and minimal resource use.
- **Private** — keep data local; no cloud services, telemetry, or remote processing unless the user explicitly requests it.

## Local Development Reference

The following setup information is provided for maintainers and people evaluating or running Zai from source. It does not indicate that pull requests are being accepted.

### Prerequisites

- [Node.js](https://nodejs.org/) compatible with the repository toolchain
- [pnpm](https://pnpm.io/) `10.33.0` (declared in root `package.json` as `packageManager`)
- [Rust](https://www.rust-lang.org/) toolchain for Tauri and backend crates
- Platform dependencies for [Tauri](https://v2.tauri.app/start/prerequisites/) when working on desktop mode

### Installation

```sh
git clone https://github.com/mastro993/zai.git
cd zai
pnpm install
```

The `prepare` script runs `pnpm exec lefthook install`, which configures Git hooks for local checks. Run `pnpm install` after cloning so hooks are installed.

### Running Locally

**Desktop (Tauri):**

```sh
pnpm dev:tauri
```

**Web (Axum server + frontend):**

```sh
pnpm dev:web
```

Use temporary or synthetic financial data during development. Do not commit real account numbers, statements, exports, credentials, or production databases.

### Architecture

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

## Submitting an Issue

- Search existing issues before opening a new one.
- Use the appropriate issue template and provide enough detail to evaluate the report or proposal.
- For bugs, include reproducible steps, expected behavior, actual behavior, and relevant environment details.
- Use only synthetic or fully redacted data. Never attach financial records, credentials, databases, or other sensitive information.
- Keep each issue focused on one bug, feature request, or suggestion.

## Coding Rules

- Keep modules focused and cohesive.
- Fix root causes; do not paper over bugs.
- Keep Tauri commands and HTTP handlers thin; delegate to `crates/core`.
- Never log secrets or real financial data.
- Store secrets via the OS keyring, not disk or `localStorage`.
- TypeScript: strict mode, `@praha/byethrow` instead of `throw`/`try`/`catch`.
- Rust: propagate errors with `?`, use `thiserror` for domain errors.

## Verification

Maintainers should run:

```sh
pnpm check
pnpm build:web
```

## Releases

Shipped desktop builds use the shared UTC Release Version `Y.M.D.B`. See
[ADR-0007](docs/adr/0007-commit-release-versions-before-building.md) and the
[release guide](docs/releasing.md).

- **Nightly:** runs at 05:00 UTC from `main` or by manual dispatch from `main`.
- **Stable:** manual-only from `main`; multiple Stable releases may use the
  same UTC date.

Do not bump release versions by hand. The `Release` and `Release Nightly`
workflows commit packed internal SemVer changes before building; UI, tags,
release names, and artifact filenames use the canonical Release Version.

## Pull Requests

Direct code, documentation, design, translation, and other pull-request contributions are not accepted at this stage. Unsolicited pull requests may be closed without review.

Submit bugs, feature requests, and suggestions through GitHub issues instead. Creating or discussing an issue does not mean a pull request is approved.

## Security Reports

Do not file security vulnerabilities as public issues. Follow [SECURITY.md](SECURITY.md) and report privately via GitHub Security Advisories.

## Licensing

If direct contributions are accepted in the future, they will be submitted under the [GNU General Public License v3.0 only](LICENSE) (`GPL-3.0-only`), and contributors must have authority to license their work on those terms.
