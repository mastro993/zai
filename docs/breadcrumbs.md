# Breadcrumbs

## 2026-08-25

- Notification list rows redesigned onto shadcn Item. Subtitle is time only. Type lives in a colored producer icon. Read/unread is an icon Toggle with "Mark read" / "Mark unread" tooltip.
- Notifications drawer body: native overflow → shadcn ScrollArea so the thin app scrollbar shows.
- Status-bar unread dot: no pulse, smaller (`size-1.5`), true circle (`corner-shape: round`). Sidebar ring separates it from the bell. Nudged toward the top-right corner.
- Notification rows compacted: Item `xs`, title/time/body `text-xs`, icon well `size-6`.
- Subtitle hover: Tooltip with absolute timestamp (`PPpp`).
- Budget snapshot Card: `mt-3` under the alert body.

## 2026-08-24

- Settings modal has no content header or breadcrumbs. Sidebar footer `Back to app` (bottom-left) returns to the previous screen. `Settings` stays the sidebar DialogTitle.
- Settings is no longer a full page that swaps the app sidebar. `/settings/*` opens a 90% viewport dialog. Left rail inside the modal keeps General/Finance sections. App chrome stays. Close returns to the previous screen.
- Status bar `z-40` so drawer/dialog backdrops cover it. TanStack panel `z-index: 30` — still slides from behind the bar.
- Alerts ledger: Sheet → Drawer, right swipe, 1rem insets, 24rem. Same pattern as transaction form.
- Notifications drawer header: drop unread sentence, title "Notifications", mono unread badge, ghost double-tick mark-all only when unread > 0.
- Notifications filters: chip bar → Filter icon menu (top right). Default unread. "Read" toggle shows also-read. Severity stays in the menu.
- Notifications drawer: drop header divider. Empty + shadcn Empty for no-notifications and filtered (Clear filters CTA).

## 2026-08-21

- Transaction list amount cell: converted on top, original muted below, no parens.

## 2026-08-20

- Amounts use `currencyDisplay: "narrowSymbol"` so list original is `(56,00 $)` not `(56,00 USD)`. Conversion-rate placeholder uses ISO both sides (`1 JPY = 0,005392 EUR on …`). Pending converted-amount skeleton covers the "Converted amount:" label too.
- Currency settings table: currency column is `ISO name (symbol)` (name + symbol muted).
- Transaction list DTO now carries original Money (`amount`, `currency`). Cross-currency rows render `({original}) {converted}` in the amount cell; same-currency stays converted only.
- Quote of 1 JPY→EUR rounded to EUR cents (`0.01`) then stored/previewed. 1000 JPY → 10 EUR. Quote now `target_leg / source_leg` with 18 sig digits. 186.5 JPY/EUR → `0.00536193…`, 1000 JPY → 5.36 EUR. UI shows that rate at 6 fractional digits (`0.005362`).
- Transaction form: drop amount "Automatic rate" copy. Non-default currency gets empty Conversion rate input; placeholder shows date rate (`1 SEK = 0,089568 € on 20/08/2026` shape). Typed override, clear reverts to date rate. Converted amount only when FX needed, under Amount label as `Converted amount: …` (pending = skeleton).
- Currency Retry now console flood: `shouldn't retry!` is reqwest TRACE on success, not a Zai retry gate. Filtered HTTP-stack logs; emit `provider_refresh` info line.
- Settings refresh column: per-row Progress meter. Backend `refreshProgress` events; no per-tick GET reconcile.
- Incremental ECB refresh 404 (no new series since `updatedAfter`) was classed `httpStatus` → Retry/add looked failed. Treat as not-modified.
- Native smoke and seed-377 benchmark on `feat/multi-currency`. Deleted throwaway `currency-prototype`. Settings search is `{ focus?: "rates" }`.

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

## 2026-08-24

- Status bar sun/moon: follow system ↔ pin opposite. `nextStatusBarTheme(resolved, system)` in `apps/frontend/src/lib/theme-toggle.ts`. Return-to-system **removes** `zai-theme` (Lea Verou: stored value None). Icon = current mode (sun light, moon dark). Appearance stays tri-state.
