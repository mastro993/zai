# Multi-currency release gate

Owned by [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377)
under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367).

This file is the living completion-evidence list. The ticket holds the decision.
Dropping a listed family blocks ship. Extra tests may be added during
implementation. Exact test function names land here when they exist.

## Fixed contracts

- Automated evidence is the complete ship gate. Prototype scenes become
  Playwright and contract tests. No separate human sign-off.
- One atomic application version. Schema, valuation, commands, UI,
  import/export, and the silent EUR migration ship together. No feature flag.
- First launch of that version creates a recoverable pre-migration backup,
  migrates transactionally, assigns EUR to every pre-currency monetary value,
  records the application-format capability, and only then opens repositories.
- Migration failure rolls back, keeps the backup, and refuses to open a
  half-migrated database. No success notice. Destructive down migration is
  refused after activation.
- Same-release clients only. A pre-multi-currency client against a migrated
  database, missing currency fields, unknown event versions, and mixed
  valuation generations fail closed before any financial read or write.
- Tests use fixed fixture identities, `ManualClock`, explicit barriers, and
  database/core failpoints. The reference workload uses replayable seed `377`.
- Structural tests assert statement counts, indexes, and set-based `SUM`.
  They do not assert wall-clock duration.

## Release-evidence matrix

The standard backend gate includes the complete released-schema fixture matrix
through the new multi-currency fixture, transport parity, currency privacy
canaries, and native Tauri currency smoke. Every fixture from `v0000_initial`
through `v0009_recurring_transactions` upgrades to head, preserves populated
finance, alert, and recurring rows, and proves silent EUR assignment on
pre-currency money.

Native smoke boots the application context with a fixed clock, registers the
production Tauri command handler in a headless mock runtime, and exercises
frontend-shaped IPC payloads plus forwarded `currency-state` events. It does
not call currency core services directly.

## Must-pass families

### Deterministic unit (`crates/core`)

- `Money` is an exact `i64` minor-unit count plus a validated ISO code. ISO
  digits come from the immutable manifest. No layer assumes two decimals.
- Conversion uses checked integer or rational arithmetic and rounds once, at
  the target ISO minor unit, with round-half-even. Overflow fails closed.
- `f64`, SQLite `REAL`, pre-rounded source legs, and unexplained persisted
  cross rates are forbidden for authoritative results.
- Rate variants are identity, automatic, manual, and pending. Amount-only
  edits keep the current revision. Date, currency, or manual-rate replacement
  appends a revision. Manual replacement without confirmation fails
  `manualRateReplacementRequired`.
- Pending rates contribute no converted value and mark every affected actual
  aggregate incomplete. Completeness rolls up. Guessed values are never
  presented as complete.
- Authored allowances restate at the period-start rate of the same class as a
  transaction exchange rate. A missing required rate makes the period
  incomplete.
- Projected occurrences use the projection-rate head. A missing pair omits
  the occurrence and marks the projection incomplete. A stale last-known-good
  rate may convert with stale status.
- Coverage is complete only for exact, approved carry-forward, and
  not-yet-due dates. Expected gaps fail closed.
- PR 1 evidence ([#399](https://github.com/mastro993/zai/pull/399)):
  `cargo test -p zai-core --lib money` (`amount_tests`,
  `manifest_tests`, `convert_tests`, `coverage_tests`). Revision history,
  `manualRateReplacementRequired`, authored-allowance restatement,
  projection heads, and setup gating wait for later stack PRs.
- Initial currency setup gates every money-bearing write and every read that
  requires a default currency. Hardcoded `EUR` in alert rich data is
  forbidden.

### Repository (`crates/db`)

- Persistence contract constraints, foreign keys, unique heads, immutability
  triggers, and required indexes all have tests.
- Valuation reads are set-based `SUM` or `COUNT` of the active generation.
  Reads never convert row-by-row in the application layer.
- One writer transaction owns each of: provider-cache publication;
  currency enablement; default-currency change plus valuation activation;
  transaction mutation with exchange-rate revision, valuation cache, budget
  suffix repair, and alerts; recurring fulfillment with the same snapshot
  invariant.
- A default-currency change builds a complete inactive generation, then
  switches heads atomically. A screen never mixes generations.
- Currency addition commits coverage proof, accepted cache data, enabled
  state, and the required generation together, or commits none of them.
- The current default cannot be disabled.
- `EXPLAIN QUERY PLAN` and statement-count tests cover provider/currency/
  value-date lookup, pending retry, generation/date, generation/converted
  value, and generation/completeness.
  `valuations::explain_tests::explain_covers_required_valuation_lookups`,
  `valuations::repository_tests::set_based_sum_is_one_statement`.

### Migration and upgrade

- A new released-schema fixture is added when the currency migration ships.
- Every fixture from `v0000` through `v0009`, plus the new fixture, loads at
  its expected version and upgrades to head.
- Upgrade proves exact preservation of money-bearing rows, relationships,
  counts, and EUR meaning. Failure injection proves transaction rollback and
  backup retention.
- A pre-multi-currency application path against a migrated fixture fails
  closed before any financial read or write.
- Destructive down migration after activation is refused.

### Concurrency

- One currency job at a time. A second start fails `currencyJobConflict`.
- Live exchange-rate refresh is supervisor-owned and not a currency job.
  One provider request is in flight at a time.
- Import commit, cancellation, crash, or a default-currency change cannot
  create a partial import or a mixed active generation.
- Stale bound-import previews cannot commit.

### Privacy

- Provider requests use the fixed ECB allow-list only. The user agent is the
  Zai version. Requests contain no installation, user, transaction, or
  database identifier.
- Canaries prove amounts, descriptions, categories, notes, and identifiers
  are absent from request URL, headers, body, logs, `currency-state` events,
  job DTOs, and error envelopes.
- Landed names: `provider_requests_omit_financial_and_identity_canaries`,
  `logs_alerts_and_error_envelopes_omit_payloads_and_canaries`,
  `frontend_and_public_transports_never_contact_a_provider`.
- Logs record stable failure class and timing only.
- The frontend never contacts a provider.

### Transport parity

- `command-contract-parity` includes every currency command.
- The server contract harness covers bootstrap, catalog, settings, setup,
  addition, disable, default-currency change, jobs, quotes, bound import
  preview and commit, and `currency-state` events.
- Native and web expose the same commands, DTO shapes, error codes, event
  envelopes, and fail-closed setup, job, and import rules.
- `import_transactions` and `import_transaction_batch` are absent from
  public surfaces.
- Lag or reconnect delivers `stateChanged`. The frontend GET-reconciles
  bootstrap, currencies, the current job, and visible money surfaces.

### Frontend

- Zod decodes every command result.
- Vitest covers Ledger Currency settings, transaction form, and
  detail/pending; Inspector import currency prep and initial setup;
  last-used session memory; manual-rate confirmation; incomplete and stale
  presentation; and durable `currency-state` reconciliation.
- Display formatting uses the currency's ISO minor-unit digits.
- Alert snapshots use the active generation's target currency.

### End-to-end

Web Playwright covers:

- Initial currency setup: locale suggestion requires confirmation; money
  writes are blocked before setup completes.
- Currency settings: add with complete coverage, disable, default-currency
  change progress, stale and failed status.
- Transaction form and detail: currency suffix, last-used, manual rate,
  pending recovery, original amount, rate, and origin.
- Import: currencyless confirmation, currency-column preparation, stale
  preview rebuild.
- Export: full-fidelity source fields, not a converted display value.
- Incomplete budget periods do not claim status, remaining allowance, or
  effective allowance.
- Persistent refresh failure creates or updates one durable alert; success
  resolves it.
- Existing lifecycle specs still pass after the e2e seed receives the silent
  EUR migration.

Landed web names:

- `e2e/currency-setup.spec.ts`:
  `currency-initial-setup confirms locale suggestion and unblocks money writes`
- `e2e/currency-journeys.spec.ts`:
  `currency settings add, disable, and default-change`;
  `transaction form remembers last-used currency and detail recovers pending rates`;
  `incomplete budget period stays Incomplete with em dash amounts`;
  `currencyless and currency-column imports prepare currencies`;
  `stale import preview rebuilds after a default-currency change`;
  `export csv keeps source currency and rate fields`;
  `refresh-failure alert opens Currency settings focused on rates`

Main Playwright keeps `ZAI_CONFIRM_DEFAULT_CURRENCY=EUR`. Initial setup runs
from `playwright.currency-setup.config.ts` (ports 3001/1421, no confirm env)
via `pnpm test:e2e:web`, only when unsharded or `--shard=1/2`.

No desktop Playwright. Native smoke covers Tauri IPC. Landed:
`native_currency_workflow_smoke`.

### Failure recovery

- Temporary rate lookup failure leaves the transaction pending, retries, and
  marks affected actuals incomplete.
- Persistent live refresh failure that affects cross-currency results updates
  one durable alert. A transient failure shows stale status only.
- Job cancel, fail, or restart before activation leaves the old default and
  active results unchanged. Incomplete staged generations resume only when
  their inputs still match; otherwise they are discarded.
- Import crash or cancel commits nothing.
- Migration crash retains the backup and refuses startup.
- Failpoints plus a child-process crash test follow the recurring pattern.

Landed names: `retry_pending_looks_up_again`,
`apply_refresh_outcome_creates_one_alert_and_resolves_on_success`,
`fail_before_activation_leaves_previous_default`,
`restart_after_failed_activation_changes_default`,
`cancelled_preview_cannot_commit`,
`placeholder_import_ids_are_replaced`,
`commit_rejects_stale_default_revision`,
`migration_failure_after_backup_keeps_backup_and_refuses_open`,
`migration_failure_after_migrate_restores_backup_and_refuses_open`.

### Import and export

- Currency-column and currencyless files.
- All supported ISO minor-unit precisions, mixed currencies, manual-rate
  direction, and pending rates.
- Coverage extension, enable, and re-enable in one atomic commit.
- Duplicate comparison uses original Money, including transaction currency.
- Empty rows and identified duplicates are explicit skips. Any other invalid
  row blocks the import.
- Stale preview, concurrent write, cancellation, and crash recovery.
- Semantic round trip for identity, automatic, manual, and pending rates,
  provider revisions, categories, quoted text, newlines, Unicode,
  spreadsheet-formula prefixes, minimum and maximum valid amounts, and
  malformed or newer-version files.
- Automatic provenance is restored only when immutable provider evidence
  validates; otherwise import is blocked.

### Performance

Pull-request CI is structural only. After commits reach `main`, the currency
reference benchmark runs in its own workflow.

## Reference workload

Run:

```bash
pnpm benchmark:currency
```

Replayable seed `377`. The runner builds one fixed binary, creates 10,000
mixed-currency transactions (identity, automatic, and pending), performs one
default-currency restatement, then one 1,000-row bound import with currency
preparation, and checks persisted counts and completeness. The wrapper
measures child working set from the runner's `READY` barrier (`vmmap`
physical footprint on macOS, `VmRSS` on Linux) and fails when either
restatement or import exceeds 60 seconds or working-set growth exceeds
64 MiB. Build time is not included. It records platform, architecture,
operating-system release, CPU model, and host memory. It uses a temporary
SQLite directory and removes it after success.

The currency benchmark is not part of pull-request or functional CI checks.

## Completion evidence

```bash
pnpm check
pnpm test:e2e:web
pnpm benchmark:currency
cargo test -p zai --lib native_currency_workflow_smoke
```

The native smoke requires the workspace `dist/index.html` stub when run
alone; `pnpm check:backend` creates it as part of the backend gate.
Exact smoke name: `native_currency_workflow_smoke`.

PR 2 evidence: `migration_currency_tests::*`,
`released_schema_fixtures_upgrade_to_head` through `v0010_multi_currency`,
`destructive_down_migration_is_refused_after_activation`,
`pre_currency_client_fails_closed_on_migrated_database`.
