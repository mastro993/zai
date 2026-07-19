# Security Policy

## Supported Versions

Zai is unfinished alpha software (`0.0.1-alpha.1` at the time of writing). There is no stable supported release yet. Only the latest code on the default branch receives best-effort security fixes.

| Version              | Supported          |
| -------------------- | ------------------ |
| Latest default branch | Best-effort fixes |
| Older commits/tags   | Not supported      |

## Reporting a Vulnerability

**Do not open a public issue for an undisclosed vulnerability.**

Report security issues privately through GitHub Security Advisories:

<https://github.com/mastro993/zai/security/advisories/new>

## What to Include

Help us triage quickly by including:

- **Affected component and version** — desktop (Tauri), web (Axum), frontend, database layer, import/export, or dependency.
- **Prerequisites** — OS, runtime versions, configuration, or data state required to reproduce.
- **Reproduction steps** — minimal, ordered steps from a clean setup.
- **Impact** — what an attacker could achieve and who is affected.
- **Proof of concept** — the smallest demonstration that shows the issue without unnecessary scope.

## Financial-Data Safety

Never attach real databases, bank statements, exports, credentials, tokens, unredacted logs, or other personal financial data to a security report.

Use synthetic or fully redacted data only. If a report requires sample data, describe how to generate it locally instead of sharing real user data.

## Response Targets

These are targets, not guarantees:

- **Acknowledgement** within three business days of a valid private report.
- **Initial triage** within seven business days, including severity assessment and next steps.

Complex issues may take longer to fix. We will keep reporters informed when coordinated disclosure timelines allow.

## Scope

In scope:

- Desktop IPC (Tauri commands and permissions)
- Loopback Axum HTTP APIs
- Persistence, migrations, and data integrity
- Import and export paths
- Dependency and supply-chain issues affecting Zai
- Release artifacts built from this repository

Out of scope:

- Unrelated marketing sites or third-party services not operated as part of Zai
- Issues in downstream forks unless they reproduce on the default branch here
- Social engineering against individual contributors

## Disclosure

We request coordinated disclosure. Please do not publish details of an unfixed vulnerability until a fix and advisory are ready, unless we agree otherwise in writing.

We credit reporters in advisories when they wish to be named.
