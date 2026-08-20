# Breadcrumbs

## 2026-08-17

- Claimed [Prototype currency settings and transaction currency controls](https://github.com/mastro993/zai/issues/371) under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367).
- Built throwaway UI prototype at `/settings?variant=A` (`?variant=A|B|C&scene=setup|settings|form|detail|import`).
- Ticket stays open until a variant (or mix) is picked. HITL; do not close on build alone.
- Resolved [Prototype currency settings and transaction currency controls](https://github.com/mastro993/zai/issues/371): Ledger settings/form/detail, Inspector import prep and setup. Fog (implementation decomposition) stays until remaining contracts close.
- Resolved [Define cross-feature valuation and aggregation contract](https://github.com/mastro993/zai/issues/374) on [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367). User accepted silent derived restatement, fail-closed incomplete actual periods, and resume-rule alerts after a default-currency change.
- Claimed [Define multi-currency API, command, and event parity contract](https://github.com/mastro993/zai/issues/376) under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367). Grill round 1 next.
- User accepted all six grill recommendations. Resolving [Define multi-currency API, command, and event parity contract](https://github.com/mastro993/zai/issues/376). Fog (implementation decomposition) stays until [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377) closes.
- Claimed [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377) under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367). Grill round 1 next.
- User accepted all four grill recommendations (A/A/A/A). Resolving verification ticket. Fog graduates to implementation-handoff sequencing.
- Claimed [Decompose multi-currency implementation into a sequenced handoff](https://github.com/mastro993/zai/issues/382) under [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367). Grill ticket. Main still pre-currency: `transactions.amount` i32, frontend `/100`, public `import_transactions` / `import_transaction_batch`, fixtures through `v0009`. 377 forbids persist-only / UI-later / feature flag.
- User accepted A/A/A. Resolving handoff ticket. Fog (implementation PRs) graduates to execution of `docs/multi-currency-handoff.md`. No further decision tickets. Map stays open until the atomic merge.
- `/to-specs` on [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367). Published [Implement production-ready multi-currency support](https://github.com/mastro993/zai/issues/385) (`ready-for-agent`). Seams reused from 377. Map stays open.

## 2026-08-18

- Implementing [Currency addition, disable, default-currency change, and Currency settings](https://github.com/mastro993/zai/issues/392) stacked on #391. Seams: CurrencyService lifecycle, transport parity, Ledger settings Vitest, refresh-failure Warning.
- Implementing [Initial currency setup and currency-state](https://github.com/mastro993/zai/issues/391) on `feat/multi-currency`, stacked on [Valuation generations and set-based budget results](https://github.com/mastro993/zai/issues/390). Fast-forwarded this worktree from `main` onto that tip.
- #391: bootstrap/catalog/settings/setup + `currency-state` v1 + Inspector first-use gate. Leftover running setup job for the same code is adopted.

## 2026-08-18

- Implementing [Valuation generations and set-based budget results](https://github.com/mastro993/zai/issues/390) on `feat/multi-currency` after merging ECB cache (#402). Seams: core valuation units + repository set-based SUM/COUNT, generation head switch, EXPLAIN/statement-count. No currency lifecycle API this PR.
- Implementing [Private ECB provider cache with privacy canaries](https://github.com/mastro993/zai/issues/389) on `feat/multi-currency` after merging Money + schema (399/401). Seams: core request/validate/refresh, cache publish, privacy canaries. No auto-refresh this PR.
- Implementing [Currency schema, silent EUR migration, and fail-closed money commands](https://github.com/mastro993/zai/issues/388) on `feat/multi-currency`. Base includes Money PR 399. Migration 0010 + backup + setupRequired gate.
- CI PR filters include `feat/**` so merges into long-lived feat branches run the same checks as `main`.
- Installed anti-slop Oxlint plugin. Copied to `tools/oxlint/anti-slop/`. Wired in `.oxlintrc.json` + `.oxfmtrc.json`. Bumped frontend `oxlint` to 1.78.0. Added root `@oxlint/plugins@1.78.0`. Migrated 444 findings so `pnpm check:frontend` is green (397 tests).
- Migrated assigned frontend test batch off `vi.mock` / unguarded `as T` / `unknown` params. Oxlint `--deny-warnings` + Vitest green on those 21 files.
- Opened local `feat/multi-currency` at current `main` (`6015578`). Implementing [Exact Money, ISO manifest, and checked conversion](https://github.com/mastro993/zai/issues/387) on this worktree branch; stack target is that long-lived branch, not `main`.
- Pushed `feat/multi-currency` and opened [PR 399](https://github.com/mastro993/zai/pull/399) onto that stack for #387. Not `main`.

## 2026-08-20

- Implementing currency native smoke and benchmark evidence on `feat/multi-currency` (PR 8 remainder). Do not land on `main`. Seams: `native_currency_workflow_smoke`, `pnpm benchmark:currency` seed 377, and failure-recovery unit names in the release gate. Deleted throwaway `currency-prototype`. Settings search is `{ focus?: "rates" }`.
