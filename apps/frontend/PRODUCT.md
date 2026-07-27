# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Zai is for self-directed people who manage their own finances and want to keep
that work local. The primary user works at a desktop, often alongside
spreadsheets, statements, or exported transaction files, and wants to enter,
organize, forecast, and review financial data without cloud sync, telemetry, or
bank-login dependencies.

## Product Purpose

Zai is a local-first personal finance application for tracking and understanding
money without handing financial data to a remote service. It combines a React
interface with Rust business logic and a local SQLite database.

Success means users can trust the stored data and derived results, complete
routine financial work without unnecessary steps, and retain exclusive control
of their information.

## Positioning

Zai's defining mechanism is a personal finance workflow that runs locally:
desktop data is stored in an on-device SQLite database, core processing runs in
the Rust backend, and the product does not depend on cloud storage, telemetry,
remote data processing, or bank connections. The Axum web mode exists for local
development and transport verification, not as a hosted service.

## Operating Context

- The primary product is a Tauri desktop application used in focused,
  mouse-and-keyboard sessions.
- Users may work from statements, spreadsheets, and transaction import or
  export files.
- Cash-flow work includes transactions, categories, budgets, recurring
  transactions, forecasts, and domain alerts.
- Dashboard, net-worth, cash-flow overview, and settings routes are part of the
  application structure; some remain incomplete during the alpha.
- The local web mode binds to loopback addresses. Its default temporary SQLite
  directory is removed during normal shutdown unless a persistent data
  directory is configured.

## Capabilities and Constraints

- Financial data is stored locally in `zai.db` under the operating system's
  application-data directory.
- Transaction and category workflows support local import and export.
- Budgeting, recurring-transaction processing, forecasting, and alerts are
  implemented as local application workflows.
- Zai is unfinished alpha software. Features, APIs, data models, and workflows
  may change, and there are no supported public binaries or stable-release
  guarantees yet.
- The current alpha does not encrypt the SQLite database at rest and does not
  provide automatic full-database backup and restore. Users must not rely on Zai
  as the only copy of important financial data.
- Real financial records, databases, statements, exports, credentials, and
  unredacted logs must never be used in public issues, tests, fixtures,
  screenshots, or demonstrations. Use synthetic or fully redacted data.
- Product decisions must uphold Zai's four pillars: Secure, Reliable,
  Efficient, and Private. Reliability and data integrity take priority over
  convenience; remote processing requires an explicit user request.

## Brand Commitments

The product name is **Zai**, derived from the Japanese word for wealth
(`ざい`). Product communication must be direct about incomplete functionality,
data-handling limits, and operational risk. The replacement visual and stylistic
direction is intentionally not defined in this product record.

## Evidence on Hand

- [`README.md`](../../README.md) is the authority for the public product
  description, alpha warning, supported setup, and current privacy and backup
  limitations.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) records the four product pillars,
  alpha status, and synthetic-data requirement.
- [`SECURITY.md`](../../SECURITY.md) records private vulnerability reporting and
  the prohibition on sharing real financial data.
- [`src/routes/`](src/routes/) and [`src/features/`](src/features/) show the
  implemented and in-progress application workflows.
- [`apps/tauri/tauri.conf.json`](../tauri/tauri.conf.json) records the desktop
  identity, local frontend entry point, security policy, and application window
  constraints.

There are no confirmed testimonials, customer logos, adoption metrics,
performance claims, or stable-release claims available for product surfaces.
Future work must not fabricate them.

## Product Principles

1. **Keep financial data under user control.** Default to local storage and
   processing; introduce remote behavior only through explicit user intent.
2. **Make correctness observable.** Preserve data integrity, deterministic
   behavior, recoverability, and clear failure states so users can trust the
   numbers.
3. **Support deliberate financial work.** Optimize workflows for fast entry,
   review, organization, and forecasting without hiding consequential actions.
4. **Stay efficient as data grows.** Keep latency and resource usage low enough
   that thousands of operations do not require a fundamental redesign.
5. **State limitations plainly.** Never disguise alpha status, missing safety
   features, or unsupported deployment modes.

## Accessibility & Inclusion

Maintain a WCAG 2.1 AA baseline, including sufficient contrast for body text and
data visualizations, semantic structure, visible keyboard focus, and respect for
`prefers-reduced-motion` on non-essential animation.
