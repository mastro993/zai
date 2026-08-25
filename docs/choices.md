# Choices

## 2026-08-25 — Snapshot sits below notification copy

- Budget status Card uses `mt-3` so body and the rich render are not flush (xs ItemContent has no gap).

## 2026-08-25 — Subtitle hover shows the absolute alert time

- Relative copy stays visible. Hover uses shadcn Tooltip with `format(createdAt, "PPpp")`. Invalid ISO falls back to the raw string.

## 2026-08-25 — Notification rows use Item size xs and 12px type

- Rows: `Item size="xs"`. Title, time, and body are `text-xs`. Type well is `size-6`. Body gets `mt-1` because xs ItemContent has no gap.

## 2026-08-25 — Status-bar unread badge is static with a sidebar ring

- Dropped `animate-pulse`. Dot is `size-1.5` with `[corner-shape:round]` (global squircle would flatten it). `ring-1 ring-sidebar` separates it from the bell. Offset `top-1 right-1`.

## 2026-08-25 — Notifications list scrolls with ScrollArea

- Ledger body uses shadcn `ScrollArea` (`min-h-0 flex-1`), same as `ScreenBase`. Native overflow dropped so the 0.375rem scrollbar token applies.

## 2026-08-25 — Notification rows use Item + type icon + read Toggle

- List rows compose shadcn Item (`size="xs"`, muted when unread). Title is ItemTitle; subtitle is time only.
- Type is the colored producer icon (budget wallet, currency dollar, recurring repeat/calendar/clock). Color follows severity: primary / amber / destructive. No type or read copy in the subtitle.
- Read state is an icon-only Toggle (`Mail01` unread, `MailOpen01` read). Tooltip + aria-label are the action: "Mark read" / "Mark unread".
- Dropped the "New" badge. Unread weight + muted Item + pressed Toggle carry status.

## 2026-08-24 — Settings modal has no content header

- No breadcrumbs, no content title bar, no dialog X. Leave via sidebar footer `Back to app` (also ESC/overlay).
- Sidebar stays full height. `Settings` DialogTitle sits at the top; `Back to app` is bottom-left. Do not nest `SidebarProvider` — it would steal `Cmd+B`.

## 2026-08-24 — Settings modal chrome matches the app shell

- Superseded: content header / breadcrumbs / close icon removed in favor of `Back to app`.

## 2026-08-24 — Settings is a large dialog, not a page

- `/settings/*` stays the URL. Layout is a Dialog at 90vw × 90dvh with the existing left section nav inside the modal.
- App sidebar stays app nav while settings is open. Back to app (ESC, overlay) returns to the last non-settings path (default `/dashboard`).
- Title bar crumbs freeze on that last app path so chrome behind the modal still reads as the page you came from.

## 2026-08-24 — Status bar stacks under overlay backdrops

- Status bar `z-40` (was `z-[100001]`). Sidebar stays `z-10`. Drawer/dialog/sheet overlays stay `z-50` and cover the bar.
- TanStack panel forced to `z-index: 30` so it still slides out from behind the bar.

## 2026-08-24 — Notifications empty states use Empty

- Header has no divider (`pb-4` only).
- Unfiltered empty: Empty + Notification icon, title "No notifications", existing description.
- Filtered empty: Empty + Filter icon, title "No matching notifications", "Clear filters" CTA.
- Both empties use Empty's dashed frame (`border` + default `border-dashed`), inset with `mx-4 mb-4 w-auto` so `w-full` + margin does not overflow the drawer.

## 2026-08-24 — Notifications filter is a header icon menu

- Chip bar (State + Severity) replaced by a ghost `icon-sm` Filter button at the header's top right, after mark-all-read.
- Menu: "Read" checkbox includes read notifications (`readState: "all"`). Severity stays as a radio group.
- Default session filter is unread + all severities. Filter trigger uses `secondary` when not at that default.
- Showing read is a view toggle, not a restrictive filter: empty copy stays the default, not "No alerts match these filters."

## 2026-08-24 — Notifications drawer header

- Title is "Notifications". Unread count is a compact secondary badge (`font-mono font-bold text-primary`) next to the title, hidden at 0.
- Visible "N unread alerts" copy removed; count stays in an `sr-only` description.
- Mark all read is a ghost `icon-sm` (`TickDouble01Icon`), shown only when unread > 0.

## 2026-08-24 — Alerts ledger is a right Drawer with insets

- Replaced Sheet with Drawer. `swipeDirection="right"`, `--drawer-inset:1rem`, transparent bleed. Same as transaction/budget/recurring drawers.
- Width: `w-[calc(100%-2rem)]` / `sm:w-96` (24rem). Dropped Sheet `28rem` and the header X; dismiss via overlay, swipe, or Escape. Focus returns to the bell.

## 2026-08-20 — Currency settings row label is ISO, name, symbol

- Currency column: `{ISO} {name} ({symbol})`. Symbol from `currencyDisplaySymbol`. Name + parens muted.

## 2026-08-20 — Transaction list shows original amount for cross-currency rows

- List DTO includes original Money (`amount`, `currency`) plus converted fields. Supersedes convert-only list from #376.
- Amount cell: when transaction currency ≠ default, converted on top, original muted below (no parens) via `formatCurrencyFromMinor` (`currencyDisplay: "narrowSymbol"`). Same-currency rows stay converted only.
- Incomplete cross-currency: `Incomplete` on top, original muted below.

## 2026-08-20 — Conversion-rate quotes keep full decimal precision

- Quote is `target_leg / source_leg` as CanonicalRate, up to 18 significant digits, half-even on the next digit.
- Do not convert 1 source unit to target Money. That rounds to ISO minor units (JPY→EUR 0.00536 → 0.01).
- Stored automatic `original_decimal` and converted-amount math keep the unrounded quote.
- UI display (form placeholder, transaction detail) rounds the rate to 6 fractional digits, half-up, then localizes.

## 2026-08-20 — Conversion-rate UI shows 6 fractional digits

- Display-only. Backend, export, typed manual input, and converted-amount math stay full precision.
- `formatConversionRateDisplay`: round half-up to 6 places, trim trailing zeros, locale decimal separator.

## 2026-08-20 — Transaction form conversion-rate field

- Cross-currency amount helper drops rate/date/origin copy. Converted amount stays under Amount.
- Converted amount shows only when currency ≠ default. FieldDescription under Amount input: `Converted amount: {formatted}`. Pending = `h-[1em] w-[14em]` skeleton covering the label too (`aria-label="Converted amount"`).
- Non-default currency always shows empty "Conversion rate" input. Placeholder is `1 SRC = rate TGT on locale-date` (both ISO, locale decimal + date).
- Typed value = manual override. Empty = selected-date rate (locked revision on amount-only edit, else quote).
- Currency change clears typed rate. Date change does not.

## 2026-08-20 — ECB updatedAfter 404 is not-modified

- Incremental refresh sends `updatedAfter`. ECB returns **404 No Series** when nothing new — not 304.
- Classify that 404 as `NotModified`. Bare 404 on initial fetch stays `httpStatus`.
- `record_not_modified` clears `failure_class` / retry_count. `updatedAfter` stored as whole-second RFC3339.

## 2026-08-20 — Per-currency refresh progress meter

- `currency-state` v1 adds `refreshProgress { current, total }`. Does not GET-reconcile; UI applies locally.
- Provider fetch emits counts (0/n … n/n). Settings row meter: live counts, else add-job stages, else durable status.
- Retry now optimistic `0/0` (indeterminate) until first event.

## 2026-08-20 — Mute reqwest TRACE on currency refresh

- `tauri_plugin_log` default level is Trace. reqwest's default retry policy logs `shouldn't retry!` on every successful GET.
- Debug builds: Debug. Release: Info. `reqwest` / `hyper` / `hyper_util` / `h2` / `rustls` / `tower` stay Warn.
- Keep reqwest default retry (HTTP/2 protocol NACKs). One `provider_refresh class=… elapsed_ms=…` info line per refresh.

## 2026-08-20

- **Manual rates written in the active generation quote that generation's target.** `prior_currency` is only for restating older revisions. After EUR→RUB→EUR a new RUB (or USD) recovery must convert to EUR, not to `prior` RUB/USD — same-currency manuals are identity and are not stored.
- **Import wizard resets file state on each open.** Reopening after a successful import must show "Select a CSV file", not the previous CSV's Change row.

## 2026-08-18 — [Budget and alert results in the active valuation generation](https://github.com/mastro993/zai/issues/395)

Seams from the ticket (no re-grill):

- Budget reads expose active-generation amounts; incomplete periods null `status` / `effectiveAllowance` / `remainingAllowance`
- Authored allowance restates at period-start rate; displayed `baseAllowance` follows the new default
- Rollover uses converted predecessor results; incomplete predecessor blocks dependent periods (Off is not blocked)
- Pause does not rewrite period math; resume emits at most one current complete-period Warning/Overspent
- Default-currency activation keeps closed-period alerts and re-evaluates the current period once
- Alert rich data uses the active generation target currency; `BUDGET_STATUS_CURRENCY` deleted
- Statistics buckets query the same transaction valuation cache; incomplete bucket = known sum + incomplete
- Command-contract-parity + existing budget/alert harnesses on the new shapes

Agent defaults:

- Stack on #393 / #394. Do not land on `main`.
- Incomplete never claims OnTrack/Warning/Overspent or remaining/effective allowance. Known converted `netBudgetSpending` still shows.
- Occurrence key stays `v1:{budgetId}:{periodStart}:{status}` (no currency). Resume + existing current alert → no second alert.
- No second aggregate cache. Net worth stays a stub.

## 2026-08-18 — [Currency addition, disable, default-currency change, and Currency settings](https://github.com/mastro993/zai/issues/392)

Seams from the ticket (no re-grill):

- `CurrencyService` public add/disable/change-default/cancel/quote/drive
- Command-contract-parity + server contract harness
- Zod decode of new command results
- Vitest for Ledger Currency settings

Agent defaults:

- Stack on #391. Do not land on `main`.
- Add and default-change return the started running job; `drive_running_job` completes it. Cancel before activate leaves the old default.
- First ECB enable without `confirmProviderDisclosure` fails `providerDisclosureRequired`. Frontend shows the disclosure then retries.
- Re-enable is `start_currency_addition` on a disabled/failed row.
- Live refresh is supervisor-owned (process start + 15m + Tauri `Resumed`). Not a job. Retry now calls the same refresh mutex.
- Persistent refresh failure that leaves enabled non-EUR rows failed/incomplete is one Warning episode. Recovery resolves it. A failed refresh that still has coverage is settings status only.

## 2026-08-18 — [Initial currency setup and currency-state](https://github.com/mastro993/zai/issues/391)

Seams from the ticket (no re-grill):

- Command-contract-parity + server contract harness for bootstrap, catalog, settings, setup, job/status, `currency-state`
- Zod decode of every new command result
- Vitest for Inspector initial currency setup
- Core units for bootstrap null-default, setupRequired, unknown event versions

Agent defaults:

- Stack on valuation generations (#390). Do not land on `main`.
- Feature folder stays `features/currency` (already on the stack).
- Bootstrap hides the silent EUR default until setup (`defaultCurrency: null`).
- Catalog and bootstrap work before setup. Settings list / get-currency fail `setupRequired`.
- Setup is a durable `currency_jobs` row. EUR / same-currency confirm runs in the request and returns the finished job.
- One running job via partial unique index. Second start fails `currencyJobConflict`.
- Locale suggestion is frontend-only: `Intl.Locale.maximize().region` plus a compact region map, else EUR if the guess is unsupported.
- Inspector setup is a full-screen first-use gate in the root shell. No new route. Workspace prototype stays unshipped.

## 2026-08-18 — [Valuation generations and set-based budget results](https://github.com/mastro993/zai/issues/390)

Seams from 374/377/390 (no re-grill):

- `zai_core::features::valuations` public API: period completeness, authored-allowance restatement, projection convert
- `crates/db` valuation repository: generation build/activate, cache upsert, set-based `SUM`/`COUNT`
- Repository structural: indexes, immutability triggers, atomic head switch, statement counts, `EXPLAIN QUERY PLAN`

Agent defaults:

- One actual valuation generation head. Projection uses provider-rate head, not a second transaction cache
- Cache rows denormalize `transaction_date` so generation/date `SUM` is set-based
- Ready/superseded generation rows are immutable; building + active stay writable
- Default-currency change: build complete inactive generation, then one writer tx switches heads
- `BudgetPeriod.complete` added; wire status/allowance stay numbers until PR 6 nulls them. Incomplete persist as SQL NULL
- Unknown rollover carry never becomes 0: dependent suffix is incomplete
- Authored allowance restates at period-start rate of transaction-exchange-rate class
- Migration `0012`. No new released fixture (0010 still upgrades)

## 2026-08-18 — [Private ECB provider cache with privacy canaries](https://github.com/mastro993/zai/issues/389)

Seams from 373/377/389 (no re-grill):

- `zai_core::features::exchange_rates` public API: request plan, payload validate, refresh service
- `ExchangeRateCache` repository publish/read
- Privacy canaries + public-surface inventory (same shape as recurring)

Agent defaults:

- Host allow-list is only `data-api.ecb.europa.eu`
- User-Agent is `Zai/{CARGO_PKG_VERSION}`
- Approved series = 29 ECB daily FX currencies in manifest v1 (RUB suspended; BGN omitted, not in v1)
- History boundary `1999-01-04`; initial load = calendar-year chunks
- Refresh uses `updatedAfter` then merges into last-known-good before validate
- Persist ECB-vs-EUR legs only; EUR cross rates computed locally
- No supervisor auto-start this PR (no request without later consent)
- Publication deadline approximated as 15:00 UTC (CET winter)
- Refresh `updatedAfter` is the last successful sync RFC3339, not HTTP Last-Modified
- Refresh sends stored ETag as `If-None-Match`
- Same payload digest after merge is `NotModified` (no second insert)

## 2026-08-18 — [Currency schema, silent EUR migration, and fail-closed money commands](https://github.com/mastro993/zai/issues/388)

Seams reused from 377/388 (no re-grill):

- Released-schema fixture upgrade matrix + new `v0010` fixture
- Connect-path backup, transactional migrate, rollback, format check
- Command/HTTP money gate (`setupRequired`)
- Post-setup amount-only writes expand to default-currency identity Money

Agent defaults:

- Format capability is `application_format.format = multi-currency-v1`
- Backup is `VACUUM INTO` `{db}.pre-multi-currency` before 0010
- Silent EUR sets enabled default + identity rates; `setup_completed_at` stays null
- Minimal sync `complete_initial_currency_setup` (job-based setup stays PR 5)
- Gate lives on money services (allow-all in unit fakes); repos stay ungated
- Persist `BIGINT`; wire/authored DTOs stay `i32`

## 2026-08-18

- **PR CI also targets `feat/**`.** `ci.yml` runs on PRs into `main` and `feat/**`. Long-lived feat stacks (e.g. `feat/multi-currency`) get the same gate as `main`. `feat/**` not `feat/*` so nested feat names still match. Benchmarks stay `push` to `main` only.

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

User-locked: durable currency jobs; mapped-row bound import preview; backend manual-rate confirmation; same-release fail-closed; setup gates all money reads/writes. List convert-only superseded 2026-08-20 (original Money on list DTO).

Agent defaults:

- One currency job at a time. Jobs = provider fetch or valuation-generation build (setup, currency addition, default-currency change, import preview). Sync = disable, import commit, CRUD, quotes, reads.
- One `currency-state` event channel. Refresh publication is `stateChanged`, not a job.
- Disable-currency warning is frontend-only.
- Wire Money stays a JSON number. Authored cap remains `i32::MAX` minor units. Persist `i64`.
- `create`/`update`/`get` transaction return the detail DTO. List includes original Money plus converted + completeness (superseded convert-only; see 2026-08-20 list original-amount choice).
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
- Eight stacked PRs: Money+manifest → schema/EUR/fixtures → ECB+privacy → valuation generations → currency lifecycle API → existing money DTOs → bound import/export → frontend+native smoke+benchmark.
- Living sequence: `docs/multi-currency-handoff.md`. Implementer may split a listed PR. Dropping a listed seam or landing it on `main` early blocks ship.

## 2026-08-17 — `/to-specs` for [Wayfind production-ready multi-currency support](https://github.com/mastro993/zai/issues/367)

Agent defaults (no re-grill; contracts already accepted):

- One spec, not eight. `/to-spec` synthesizes the product+contract source of truth. The eight-PR stack stays the execution sequence.
- Test seams = families already locked in [Define multi-currency production verification and rollout contract](https://github.com/mastro993/zai/issues/377). Highest existing first: native smoke, command-contract-parity, privacy canaries, released-schema fixtures, repository structural, core units, frontend Vitest, failure-recovery, post-`main` benchmark.
- Published [Implement production-ready multi-currency support](https://github.com/mastro993/zai/issues/385) with `ready-for-agent`. Map 367 stays open until the atomic merge.

## 2026-08-18

- **Anti-slop lives at `tools/oxlint/anti-slop/`.** Local Oxlint JS plugin, not a published package. Root `.oxlintrc.json` registers it; all 15 rules are `"error"`.
- **Oxlint + `@oxlint/plugins` pinned to 1.78.0.** Same current versions. `oxlint` stays a frontend devDep; `@oxlint/plugins` is a root devDep so the vendored plugin resolves from `tools/`.
- **Anti-slop migration shipped with the install.** Stop hook requires `pnpm check`. Findings were fixed, not suppressed: `satisfies` / named contracts, zod + `asWire*` instead of `typeof`/`unknown`, `setCommandTransports` + file-capability adapters instead of `vi.mock`, `schema.parse` fixtures instead of `as T`.
- **Tauri plugin ESM exports are not spyable** (`configurable: false`). File-capability tests inject `{ web, tauri }` adapters; real `tauriSelectCsvImportFile` / `tauriDownloadTextFile` / Tauri `listen` are called only to assert fail-closed outside Tauri.
- **Table-driven web-request `as never` replaced with `check<T>(build, args, expected)`.** Dropped type-lie cases (`items: "bad"`, invalid enum keys). Kept empty id / revision 0.

## 2026-08-18 — [Exact Money, ISO manifest, and checked conversion](https://github.com/mastro993/zai/issues/387)

Seams (from the ticket + 370/372): `zai_core::money` public API only. No schema, commands, UI.

- **Manifest v1** pins SIX List One `2026-01-01` and CLDR 48.2. 155 fiat candidates. Generator: `scripts/generate-currency-manifest.py`.
- **VED `valid_from` = 2021-10-01** from ISO 4217 Amendment 170. CLDR 48.2 lists VED as `tender=false` with no `from`.
- **Wire/authored cap** is `i32::MAX` via `Money::from_authored` / `try_to_wire_minor_units`. Persist constructor accepts `i64`.
- **`num-bigint` 0.4.8** for conversion intermediates. Round half-even once at the target ISO digits. No `f64`.
- **Automatic legs share a `rate_set_id`.** Same value date is not enough; unexplained cross rates stay forbidden.
- **CLDR pin URL is the raw `supplementalData.xml`** that matches `CLDR_SHA256`, not the GitHub HTML blob page.

## 2026-08-24 — Status bar theme toggle follows-or-overrides system

- Two-state control. Three-state model. See https://lea.verou.me/blog/2026/dark-mode-toggles/
- Click flips the resolved UI.
- Persist `"dark"` / `"light"` only when that result differs from the OS scheme.
- When the result matches the OS, **remove** `zai-theme`. Do not persist `"system"` or a matching light/dark pin.
- Evaluate match-vs-OS only on click. An OS change that later equals an override must keep the override.
- Appearance settings stay the 3-way Light / Dark / System control.
