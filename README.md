# Zai

Zai (ざい, japanese word for _wealth_) is a local-first personal finance app for people who want to track their money without cloud sync, telemetry, or bank-login dependencies.

Zai takes significant inspiration from [Wealthfolio](https://github.com/wealthfolio/wealthfolio) and [Sure](https://github.com/we-promise/sure). It is my own interpretation of what a personal finance app can be.

> [!WARNING]
> This is an early alpha software. Features are incomplete, releases are not yet considered stable, and automatic full-database backup and restore are not implemented.
> Do not use Zai as the only copy of important financial data.

## Installation

There are no supported public binaries yet.

To run the project from source, follow the development instructions below.

## Development

### Prerequisites

- Git
- Node.js LTS
- pnpm 10.33.0
- Rust stable
- The platform dependencies required by
  [Tauri](https://v2.tauri.app/start/prerequisites/)

### Desktop quick start

```bash
git clone https://github.com/mastro993/zai.git
cd zai
pnpm install --frozen-lockfile
pnpm dev:tauri
```

`pnpm install` also installs the repository’s Lefthook Git hooks.

### Local web development

Web mode exists for development and transport verification. The Axum server is
restricted to loopback addresses and is not intended for hosted or remote use yet

```bash
pnpm dev:web
```

By default, web mode creates a temporary SQLite directory and removes it during
normal shutdown. To keep data between runs:

```bash
cp .env.web.example .env.web
```

Then configure `ZAI_DATA_DIR` in `.env.web`.

## Data, privacy and backups

Desktop data is stored in a local SQLite database named `zai.db` under the
operating system’s application-data directory.

The current alpha:

- does not include cloud sync, bank connections, or telemetry;
- does not encrypt the SQLite database at rest;
- does not provide automatic full-database backup and restore;
- may run migrations as the schema evolves.

Back up important source data independently. Never attach a real Zai database,
financial statement, or unredacted log to a public issue.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. By
participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Please use synthetic data in tests, screenshots, fixtures, and bug reports.

## Security

Do not report vulnerabilities through a public issue and do not attach
financial records or databases.

Follow the private reporting instructions in [SECURITY.md](SECURITY.md).
