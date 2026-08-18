# Multi-currency implementation handoff

Owned by [Decompose multi-currency implementation into a sequenced handoff](https://github.com/mastro993/zai/issues/382)
under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367).

This file is the living implementation sequence. The ticket holds the decision.
Ship evidence stays in [`docs/multi-currency-release-gate.md`](./multi-currency-release-gate.md).
Exact PR numbers and test names land here when they exist.

## Destination

One atomic application version that ships schema, valuation, commands, UI,
import/export, and the silent EUR migration together. Main stays pre-currency
until the release gate is green. That merge is the version.

## Fixed contracts

- Long-lived `feat/multi-currency` stack. Do not land currency work on `main`
  until the final stack merge.
- No feature flag. No persist-only or UI-later split. No unused Money, manifest,
  or ECB client on `main` before the atomic merge.
- Every stack tip fail-closes: no mixed-generation read, no old DTO against
  migrated money, no public `import_transactions` / `import_transaction_batch`
  after schema activation, no half-migrated fixture.
- Same-release clients only. A pre-multi-currency client against a migrated
  database fails closed before any financial read or write.
- Implementer may split a listed PR. Dropping a listed seam, reordering past a
  fail-closed rule, or landing a listed PR on `main` early blocks ship.
- Vertical product slices (setup, then transactions, then budgets) that merge
  independently are forbidden.

## Merge rule

1. Open `feat/multi-currency` from current `main`.
2. Stack the eight PRs below. Each targets the previous stack commit.
3. Stack-tip CI stays green (`pnpm check`; web e2e from PR 2 onward after the
   seed completes initial currency setup).
4. When [`docs/multi-currency-release-gate.md`](./multi-currency-release-gate.md)
   is green on the tip, merge the stack to `main` as one version.
5. After `main`: `pnpm benchmark:currency` in its own workflow.

## Fail-closed rule

From PR 2 onward, money-bearing commands that are not yet restored return
`setupRequired` (or the stricter mixed-generation / missing-field failure)
before any financial read or write. The branch e2e seed silently assigns EUR,
then confirms EUR as the default currency, so existing lifecycle specs keep
passing.

`BUDGET_STATUS_CURRENCY = "EUR"` is deleted in PR 6. Until then it must not
ship to `main`.

## Stack

Each PR is blocked by the previous. Gate families are the ones that PR must
add or keep green; the full list still ships only at the final merge.

### 1. Core Money + manifest

- `Money` is an exact `i64` minor-unit count plus a validated ISO code.
- ISO digits come from the versioned ISO/SIX and CLDR manifest. No layer
  assumes two decimals.
- Conversion uses checked integer or rational arithmetic and rounds once, at
  the target ISO minor unit, with round-half-even. Overflow fails closed.
- Rate variants: identity, automatic, manual, pending.
- No schema. No commands. No UI.
- Gate: deterministic unit family for Money, conversion, and coverage
  completeness rules that do not need persistence.
- Landed on `zai_core::money`. PR: [#399](https://github.com/mastro993/zai/pull/399).
  Tests: `cargo test -p zai-core --lib money`.
  Families: `money::amount_tests`, `money::manifest_tests`,
  `money::convert_tests`, `money::coverage_tests`.

### 2. Schema + silent EUR + fixtures

- Migration `0010` (name may increment if `main` moved). Pre-migration backup,
  one transactional migrate, EUR on every pre-currency monetary value,
  identity rates for same-currency EUR, application-format capability, then
  repositories open.
- Failure rolls back, keeps the backup, refuses a half-migrated database.
- Destructive down migration refused after activation.
- New released-schema fixture. Every fixture from `v0000_initial` through
  `v0009_recurring_transactions` upgrades to head and proves silent EUR
  assignment.
- Persist `i64`. Wire and authored cap stay `i32::MAX`.
- Existing money commands fail closed until later PRs restore them.
- E2E seed on this branch: silent EUR + confirmed EUR setup.
- Gate: migration and upgrade family.
- Landed in this stack PR. Tests: `cargo test -p zai-db --lib migration_`.
  Families: `migration_currency_tests`, released-schema upgrade through
  `v0010_multi_currency`, failpoint rollback, pre-currency fail-closed.

### 3. ECB service + provider cache + privacy canaries

- Rust-owned cache-first ECB client. Fixed allow-list. User agent is the Zai
  version. Frontend never contacts a provider.
- Immutable accepted rate sets. Refresh stages and validates the complete
  fixed ECB set, then one atomic head switch.
- Requests, logs, `currency-state` events, job DTOs, and error envelopes
  contain no amounts, descriptions, categories, notes, or identifiers.
- Gate: privacy canaries; provider-cache unit and repository tests that do
  not yet require valuation heads.
- Landed in this stack PR. Tests: `cargo test -p zai-core --lib exchange_rates`,
  `cargo test -p zai-db --lib exchange_rates`,
  `cargo test -p zai-app --lib ecb`,
  `cargo test -p zai-server --test currency_privacy_canaries --test currency_privacy_inventory`.

### 4. Valuation generations

- Rebuildable per-transaction cache keyed by generation. Converted `i64`
  Money plus completeness.
- Valuation reads are set-based `SUM` or `COUNT` of the active generation.
  Replace `crates/db/src/budgets/timeline/calculate.rs` row-by-row fold.
- Default-currency change builds a complete inactive generation, then
  switches heads atomically. Screens never mix generations.
- Authored allowances restate at the period-start rate of the same class as
  a transaction exchange rate. Pending rates mark affected actuals incomplete.
- Projections use the projection-rate head, not a transaction exchange rate.
- Gate: repository valuation family; statement-count and `EXPLAIN QUERY PLAN`
  tests listed in the release gate.
- Landed tests: `cargo test -p zai-core --lib features::valuations`,
  `cargo test -p zai-db --lib valuations`.

### 5. Currency lifecycle API

- Commands and HTTP from [Define multi-currency API, command, and event parity contract](https://github.com/mastro993/zai/issues/376):
  bootstrap, catalog, settings, setup, addition, disable, default-currency
  change, jobs, status, quotes.
- One `currency-state` channel, version `1`. Lag or reconnect delivers
  `stateChanged`. Frontend GET-reconciles.
- One currency job at a time. Second start fails `currencyJobConflict`.
  Live refresh is supervisor-owned and is not a job.
- Tauri + Axum + Zod + `command-contract-parity`. Same DTO shapes and error
  codes on native and web.
- Gate: transport parity for the new currency commands; setup fail-closed.

### 6. Rewrite existing money DTOs

- Transaction list: `convertedAmount`, `convertedCurrency`, `complete` only.
- `get` / `create` / `update` / `delete` return the detail DTO: original
  Money, current rate revision, converted fields.
- Recurring templates carry original Money, never a rate. Budgets expose
  active-generation amounts; incomplete periods null `status`,
  `effectiveAllowance`, and `remainingAllowance`.
- Restore money CRUD behind completed setup. Manual-rate replacement without
  `confirmManualRateReplacement` fails `manualRateReplacementRequired`.
- `find_existing_duplicate_keys` includes transaction currency.
- Alert rich data uses the active generation's target currency. Delete
  `BUDGET_STATUS_CURRENCY`.
- Gate: existing command parity and contract harnesses on the new shapes.

### 7. Bound import + full-fidelity export

- `preview_transaction_import` / `get_transaction_import_preview` /
  `commit_transaction_import` only. Commit revalidates the bound preview.
- Remove `import_transactions` and `import_transaction_batch` from public
  surfaces.
- Currency-column and currencyless files. Duplicate comparison uses original
  Money, including transaction currency.
- Export preserves original amount, transaction currency, fixed rate, rate
  date, and supplied or manual origin. A converted display value never
  replaces those source values.
- Gate: import/export family, including semantic round trip and stale-preview
  rejection.

### 8. Frontend + e2e + native smoke + benchmark

- Ledger: Currency settings, transaction form, detail/pending.
- Inspector: initial currency setup, import currency prep.
- Do not ship the Workspace prototype. Last-used transaction currency stays
  frontend session memory.
- Display formatting uses the currency's ISO minor-unit digits. Stop dividing
  by 100 and locking `Intl` at two fraction digits.
- Web Playwright, `native_currency_workflow_smoke`, `pnpm benchmark:currency`.
- Prototype scenes become tests. Throwaway `currency-prototype` does not ship.
- Gate: frontend, end-to-end, failure-recovery, and completion-evidence
  commands in the release gate. Then merge to `main`.

## Starting facts on `main`

These are true until the atomic merge. Do not treat them as the target.

- `transactions.amount` and recurring template amounts are `INTEGER` / `i32`.
- Budget allowances and period results are already `BIGINT` / `i64`.
- Frontend `formatCurrencyFromMinor` divides by 100 and formats two decimals.
  Call sites pass `"EUR"`.
- Import mapping has no currency column. Dedup is date + amount + description.
- Export CSV is `date,amount,type,description,notes,parent_category,category`
  with `amount / 100`.
- Budget spending is a row-by-row fold of `transactions.amount`.
- `BUDGET_STATUS_CURRENCY` is hardcoded `"EUR"`.
- Released fixtures stop at `v0009_recurring_transactions`.
- No `Money` type, currency module, rate cache, valuation generation, or
  settings table.

## Completion

The sequence is done when the stack has merged to `main` and the completion
evidence in [`docs/multi-currency-release-gate.md`](./multi-currency-release-gate.md)
has been recorded:

```bash
pnpm check
pnpm test:e2e:web
pnpm benchmark:currency
cargo test -p zai --lib native_currency_workflow_smoke
```
