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
