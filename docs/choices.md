# Choices

## 2026-08-17

- **Currency prototype lives on `/settings?variant=`, not a new route.** Five scenes still share one lab, but a dedicated `/prototype/currency-controls` dirty `routeTree.gen.ts` and fails `check:routes` until commit. Existing Settings host keeps the gen file clean.
- **Three variants: Ledger, Inspector, Workspace.** Ledger is table-first and compact. Inspector is a two-pane document. Workspace is a default-currency hero with blocking banners and dual amounts. Structure differs; tokens do not.
- **Scenes via `?scene=`.** Variant and scene are orthogonal so a reviewer can compare the same surface across layouts without remounting fixtures.
- **In-memory fixtures only.** EUR default, USD last-used, GBP stale, JPY adding, CHF disabled, CAD import-only. No backend, no persistence.
- **Accepted UI mix:** Ledger for Currency settings, transaction form, and detail/pending. Inspector for import currency prep and initial setup. Do not ship Workspace.
- **Authored allowance converts at the period-start fixed rate** for elapsed and current actual periods. Live projection exchange rates convert future projected periods only.
- **Unknown rollover carry does not pretend to be zero.** Incomplete dependents may show known converted spending; they do not claim remaining or effective allowance.
- **No separate budget allowance-currency picker.** The user authors the allowance in the default currency of that configuration version.
- **Net worth stays outside this multi-currency map.** Statistics and charts that ship use the transaction valuation cache.

## 2026-08-17 — [Define multi-currency API, command, and event parity contract](https://github.com/mastro993/zai/issues/376)

User-locked: durable currency jobs; list DTOs convert-only; mapped-row bound import preview; backend manual-rate confirmation; same-release fail-closed; setup gates all money reads/writes.

Agent defaults:

- One currency job at a time. Jobs = provider fetch or valuation-generation build (setup, currency addition, default-currency change, import preview). Sync = disable, import commit, CRUD, quotes, reads.
- One `currency-state` event channel. Refresh publication is `stateChanged`, not a job.
- Disable-currency warning is frontend-only.
- Wire Money stays a JSON number. Authored cap remains `i32::MAX` minor units. Persist `i64`.
- `create`/`update`/`get` transaction return the detail DTO. List stays converted + completeness.
- Last-used transaction currency stays session memory.

## 2026-08-17 — [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377)

User-locked: all four grill recommendations.

- Automated evidence is the complete ship gate. No human walkthrough or signed QA checklist.
- Performance split matches recurring: PR = structural; `main` = `pnpm benchmark:currency`. Seed `377`. 10k mixed-currency restatement + 1k-row bound import. Fail >60s or >64 MiB working-set growth.
- One atomic app version. No feature flag. Silent EUR migrate on first launch behind a pre-migration backup. Fail-closed downgrade.
- Closed must-pass list. Living file: `docs/multi-currency-release-gate.md`. Implementer may add tests. Dropping a listed family blocks ship.

## 2026-08-17 — [Decompose multi-currency implementation into a sequenced handoff](https://github.com/mastro993/zai/issues/382)

User-locked: all three grill recommendations (A/A/A).

- Merge surface: long-lived `feat/multi-currency` stack. `main` stays pre-currency. One merge when the release gate is green. That merge is the atomic version. Unused core does not land on `main` early.
- Eight stacked PRs: Money+manifest → schema/EUR/fixtures → ECB+privacy → valuation generations → currency lifecycle API → existing money DTOs → bound import/export → frontend+e2e+smoke+benchmark.
- Living sequence: `docs/multi-currency-handoff.md`. Implementer may split a listed PR. Dropping a listed seam or landing it on `main` early blocks ship.

## 2026-08-17 — `/to-specs` for [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367)

Agent defaults (no re-grill; contracts already accepted):

- One spec, not eight. `/to-spec` synthesizes the product+contract source of truth. The eight-PR stack stays the execution sequence.
- Test seams = families already locked in [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377). Highest existing first: Playwright lifecycle, native smoke, command-contract-parity, privacy canaries, released-schema fixtures, repository structural, core units, frontend Vitest, failure-recovery, post-`main` benchmark.
- Published [Implement production-ready multi-currency support](https://github.com/mastro993/zai/issues/385) with `ready-for-agent`. Map 367 stays open until the atomic merge.
