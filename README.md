# Zai

> [!WARNING]
> **Zai is in early development. Expect data loss.** Features and data models may
> change without notice. Correct data migration between releases is not
> guaranteed, and automatic database backup and restore are not implemented yet.
> Keep independent backups and do not use Zai as the only copy of important data.

Zai (ざい, japanese word for _wealth_) is a local-first personal finance app for people who want to track their money without cloud sync, telemetry, or bank-login dependencies.

Zai takes significant inspiration from [Wealthfolio](https://github.com/wealthfolio/wealthfolio) and [Sure](https://github.com/we-promise/sure), but it is not meant to reproduce either project. It is my own interpretation of what a personal finance app should and could be.

I believe personal finance software should help people understand their money without requiring them to hand their financial history to a third party. Users should stay in control of their data and be able to understand how the app reaches its numbers. Zai is my attempt to build toward that idea from a local-first foundation and discover what becomes possible from there.

Zai is a side project, not a business. It will never be sold or used as a source of income. Monetization is not its goal.

## An agent-driven experiment

Zai is developed as a 100% agent-driven software experiment. I do not write or
edit a single line of code myself. I decide what the product should do, plan the
work with AI agents, turn requirements into issues, and ask agents to implement
them. When the work is complete, I press the green merge button. Product
direction and the final merge decision remain human; the code is agent-written.

The experiment asks a simple question: does software written entirely by AI
inevitably become low-quality "slop," or can an agent-driven process produce
trustworthy software when planning and verification are taken seriously?

I chose an open-source personal finance app because it is a demanding test:

- It must be **secure** because it handles sensitive financial data.
- It must be **efficient** enough to handle thousands of transactions and
  operations.
- It must be **reliable** because even a small rounding error can distort
  someone's financial data.
- It must be **private** so each user's data stays on their device.

These are the standards the experiment must meet, not claims that Zai has
already met them. The early-development warning at the top of this README still
applies. The goal is to test whether software written entirely by AI can meet
serious standards for security, performance, reliability, and privacy when the
process is designed well.

## Installation

Official desktop binaries for macOS, Linux, and Windows are available from
[GitHub Releases](https://github.com/mastro993/zai/releases). Zai publishes two
release channels. Both are built from `main` through the same checks and
artifact pipeline, but they have different release cadences.

### Stable

Stable releases are published manually and are the recommended channel for most
users. They receive updates less often than Nightly releases and appear on
GitHub as full releases named `Zai Y.M.D.B`. Download the most recent build from
the [latest Stable release](https://github.com/mastro993/zai/releases/latest).

"Stable" describes the release channel, not the maturity of Zai or its data
format. Zai remains in early development, and the data-loss and migration
warning at the top of this README applies to Stable releases too.

### Nightly

Nightly releases contain the latest changes from `main`. A new Nightly is
scheduled for 05:00 UTC when changes exist, and maintainers can also trigger one
manually. Nightlies appear as prereleases named `Zai Nightly Y.M.D.B` on the
[Releases page](https://github.com/mastro993/zai/releases).

Choose Nightly only if you want to test recent changes and can tolerate more
regressions, incomplete behavior, and data loss. Nightly builds are not a safer
backup or migration path than Stable builds.

To run Zai from source instead, follow the development instructions below.

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

The current beta:

- does not include cloud sync, bank connections, or telemetry;
- does not encrypt the SQLite database at rest;
- does not provide automatic full-database backup and restore; and
- does not guarantee that migrations will preserve existing data between releases.

Back up important source data independently. Never attach a real Zai database,
financial statement, or unredacted log to a public issue.

## Contributing

Zai is not ready to accept direct contributions or pull requests because its
roadmap and contribution process are not defined yet. For now, contribute only
through [GitHub issues](https://github.com/mastro993/zai/issues/new/choose) for
bug reports, feature requests, and suggestions. Opening an issue does not
authorize a pull request or guarantee implementation.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full policy. By participating,
you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Use synthetic or
fully redacted data in issue reports.

## Security

Do not report vulnerabilities through a public issue and do not attach
financial records or databases.

Follow the private reporting instructions in [SECURITY.md](SECURITY.md).
