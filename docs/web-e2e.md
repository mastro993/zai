# Web end-to-end tests

The Playwright suite verifies critical user journeys through the web frontend,
Axum API, and temporary SQLite database. It measures behavior coverage, not
source line or branch coverage.

## Coverage matrix

| Area | Covered journeys | Specs |
| --- | --- | --- |
| Alerts | Accessible ledger, responsive layout, reduced motion, read and unread reconciliation, mark-all-read, destination navigation, filters, cursor pagination | `alerts-ledger.spec.ts` |
| Budgets | Create, edit, pause, resume, delete, reload durability, status calculation, live critical alert | `budget-lifecycle.spec.ts`, `budget-status-alert.spec.ts` |
| Categories | Web-mode smoke, root creation, child hierarchy, rename, child deletion, root deletion, reload durability | `web-smoke.spec.ts`, `category-hierarchy-lifecycle.spec.ts` |
| Transactions | Create, edit type/amount/category, delete, reload durability; recurring adoption and provenance navigation | `transaction-lifecycle.spec.ts`, `recurring-workflow.spec.ts`, `recurring-production-journey.spec.ts` |
| Recurring transactions | Creation timing, catch-up, adoption, editing, lifecycle actions, bulk partial commits, refresh interruption, recovery, alerts, provenance, budget impact, forecast attribution, focus, reconnect | `recurring-*.spec.ts` |
| Forecast | Matrix navigation, attribution drill-down across budget-period boundaries, incomplete state, focus return | `recurring-production-journey.spec.ts`, `recurring-workflow.spec.ts` |

Most journeys use the real web stack. Alert-ledger tests mock alert routes to
exercise isolated UI states deterministically. Network and concurrency tests
intercept only the requests needed to create the failure being verified.

## Reliability contract

- Tests pass on any calendar date, in any execution order, and on repeated runs.
- Each test owns uniquely named data. Include `workerIndex`, `repeatEachIndex`,
  and `retry` when generated identities could collide.
- Target owned domain records by accessible name or identifier. Do not select a
  transaction, budget, category, or recurring transaction through positional
  `.first()` or `.nth()` locators.
- Treat calendar and budget-period boundaries as domain behavior. Aggregate
  across periods when a journey spans a boundary instead of assuming every
  occurrence belongs to one cell.
- Use observable conditions and Playwright assertions. Do not add fixed sleeps.
- Perform the journey's primary actions through the UI. API setup may seed
  prerequisites that are not under test.
- Verify durable mutations after reload. A toast or optimistic row alone is not
  persistence evidence.
- Keep the shared server and database for suite speed. Tests must not require an
  empty database or state left by another test.
- Mock only isolated UI states or deliberate failures. Normal create, edit,
  delete, and reload journeys use Axum and SQLite.

## Running

Run the complete suite:

```sh
pnpm test:e2e:web
```

Run one spec or one named journey:

```sh
pnpm test:e2e:web e2e/transaction-lifecycle.spec.ts
pnpm test:e2e:web --grep "forecast drill-down attributable"
```

Playwright starts `zai-server` on `127.0.0.1:3000`, the frontend on
`127.0.0.1:1420`, and creates a temporary `ZAI_DATA_DIR`. Configuration keeps
one worker and zero retries so shared-state bugs and flakiness remain visible.

## CI contract

The change classifier always runs. For pull requests, it skips both E2E shards
only when every changed file is Markdown or `LICENSE`. Any source, test,
configuration, dependency, lockfile, migration, or workflow change runs both
shards. A final `Web E2E` job reports the result and is the future required
status; the repository ruleset is not changed by this workflow.

Pull-request shards stop after the first failure in each shard. For a manual
diagnostic run, collect all failures with:

```sh
PLAYWRIGHT_MAX_FAILURES=0 pnpm test:e2e:web
```

The matrix uses `fail-fast: false`, and Playwright uses test-level balanced
sharding (`fullyParallel: true`).

The limits are:

| Limit | Value |
| --- | --- |
| Action timeout | 15 seconds |
| Navigation timeout | 30 seconds |
| Assertion timeout | 15 seconds |
| Test timeout | 120 seconds |
| Shard job timeout | 3 minutes |
| Retries | 0 |

Failed shards upload Playwright error context, screenshots, and traces for
seven days. Video recording is disabled. The workflow does not publish a
merged HTML report, use a browser cache or container, or send telemetry. Each
shard writes setup, test, shard, and total durations to its GitHub job summary.
The target is less than two minutes for a green CI run and less than 90 seconds
to report a useful failure.

Rollout evidence is a later operations step, not part of this change: push the
implementation PR, record five green GitHub runs and three controlled-failure
attempts, then remove the temporary failure probe. Merge while `Web E2E` is
optional, confirm that the workflow exists on `main` and that the stable
aggregator appears on the next eligible pull request, then require `Web E2E`
and observe the next 20 pull requests. Do not add the probe to this workflow or
change the repository ruleset in this change.

Use a WebdriverIO-only benchmark only if profiling shows that browser execution
remains the dominant cost. Do not run both frameworks or compensate with
retries or wider timeouts.

On restricted macOS automation hosts, Chromium may fail before opening a page
with:

```text
bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)
```

This is a browser-process permission failure, not an application assertion
failure. Re-run where Chromium may launch before changing application or test
behavior.

## Explicit exclusions

- CSV import and export journeys: parsing, mapping, and file-capability routing
  remain covered by focused frontend tests.
- Dashboard, Net Worth, and Settings product journeys.
- Native Tauri behavior.
- Source line or branch percentage targets.

Add excluded journeys only when their cross-layer regression risk justifies
their runtime and maintenance cost.
