# Budget Cadence, Scope, and Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make budget period calculation and transaction matching support every cadence, category scope, and signed measurement rule in issue #67.

**Architecture:** Keep cadence arithmetic, scope canonicalization, and contribution semantics in `crates/core` as small pure functions. Keep SQLite row loading, category hierarchy expansion, and transaction filtering in `crates/db`; the serialized writer remains the atomic mutation boundary. Extend existing Tauri/Axum/frontend contracts without changing omitted-field defaults.

**Tech Stack:** Rust 2024, chrono, Diesel SQLite, Tokio, Axum, Tauri IPC, React 19, React Hook Form, Zod, Vitest.

## Global Constraints

- Use half-open local-calendar periods: `start <= transaction_date < end`.
- Monday is the first day of weekly periods.
- Empty scope includes categorized and uncategorized transactions.
- Spending ignores Income-category and uncategorized income; Net cash flow subtracts every matching income.
- Preserve signed checked arithmetic; never clamp results.
- Keep data local; use existing SQLite writer and no telemetry.
- Keep changed files below 400 LOC; split focused helpers when needed.

---

### Task 1: Core cadence and scope contracts

**Files:**
- Modify: `crates/core/src/features/budgets/models.rs`
- Test: `crates/core/src/features/budgets/models.rs` module tests

**Interfaces:**
- Add `BudgetCadence::{Day, Week, Month, Year}` with stable strings.
- Add `CategoryHierarchy { id: String, parent_id: Option<String> }`.
- Add `current_period(now: NaiveDateTime, cadence: BudgetCadence)`.
- Add deterministic `canonicalize_category_ids` and `expand_category_scope` helpers.
- Extend `NewBudget` with optional `cadence` and defaulted `category_ids`; extend `Budget` with the resolved cadence and scope.

- [ ] Write tests for day, Monday-week, month, and year boundaries, including leap-year February and January 1.
- [ ] Write tests proving duplicate selections collapse and a selected ancestor removes selected descendants while a child-only selection remains.
- [ ] Run `cargo test -p zai-core budgets::models`; expect compile failures for the new fields/helpers before implementation.
- [ ] Implement cadence parsing/display/serialization, checked boundary arithmetic, hierarchy canonicalization, and scope expansion.
- [ ] Run the focused core tests; expect all new boundary and scope cases to pass.
- [ ] Run `cargo fmt --all --check` and `cargo clippy -p zai-core --all-targets --all-features -- -D warnings`.

### Task 2: SQLite budget matching and persistence

**Files:**
- Create: `crates/db/migrations/2026-07-12-110000-0005_budget_cadences/up.sql`
- Create: `crates/db/migrations/2026-07-12-110000-0005_budget_cadences/down.sql`
- Modify: `crates/db/src/budgets/repository.rs`
- Modify: `crates/db/src/budgets/models.rs`
- Modify: `crates/db/src/budgets/repository_tests.rs`
- Modify: `crates/db/src/schema.rs` only if Diesel regeneration requires it

**Interfaces:**
- `BudgetsRepository::create_budget` persists resolved cadence and canonical scope.
- `calculate_spending` accepts cadence-independent boundaries, measurement mode, and expanded scope IDs.
- Existing empty/month/Spending payloads retain current behavior.

- [ ] Add repository tests for explicit child scope, root scope including children, redundant root/child canonicalization, and unrelated-category exclusion.
- [ ] Add tests for empty-scope uncategorized income in both modes, Income-category income, Spending-category refunds, expenses in either role, zero matches, negative net spending, and overlapping budgets.
- [ ] Add tests placing transactions exactly at period end and beginning for day/week/month/year.
- [ ] Run the focused DB tests; expect new scope/cadence cases to fail against current month/all-transaction matching.
- [ ] Add migration that rebuilds the budget table constraint to allow `day`, `week`, `month`, and `year` while preserving rows and indexes.
- [ ] Load active category hierarchy, canonicalize selections on create, expand selected roots for matching, and filter by `transaction_date >= start` and `< end`.
- [ ] Apply checked signed contribution rules for expense/income and parse stored cadence/scope when rebuilding.
- [ ] Run focused DB tests and existing server budget tests; expect all to pass.

### Task 3: Transport and frontend choices

**Files:**
- Modify: `apps/server/src/api/cash_flow/budgets.rs`
- Modify: `apps/tauri/src/commands/budgets.rs` only if command payload plumbing needs changes
- Modify: `apps/frontend/src/features/cash-flow/types/budget.ts`
- Modify: `apps/frontend/src/features/cash-flow/commands/budgets.ts`
- Modify: `apps/frontend/src/routes/cash-flow.budgets.tsx`
- Modify: `apps/frontend/src/features/cash-flow/screens/budget-screen.tsx`
- Modify: `apps/frontend/src/features/cash-flow/components/budget-form-dialog.tsx`
- Modify: `apps/frontend/src/features/cash-flow/screens/budget-detail-screen.tsx`
- Test: `apps/frontend/src/features/cash-flow/types/__tests__/budget.test.ts`
- Test: `apps/frontend/src/commands/__tests__/budget-command-map.test.ts`

**Interfaces:**
- Create payload accepts `cadence`, `categoryIds`, and `measurementMode` while omitted values default server-side.
- Form exposes cadence, measurement mode, and category selection; empty selection means all transactions.
- Detail/ledger render selected scope, cadence, and effective measurement mode.

- [ ] Extend Zod schemas/tests with cadence, measurement mode, and category IDs while preserving old input defaults.
- [ ] Extend command wrapper and route loader to fetch categories for the create dialog.
- [ ] Add shadcn/Base UI controls for cadence, measurement mode, and multi-category selection; keep empty scope explicit.
- [ ] Render signed values and human-readable cadence/scope/mode labels in budget screens.
- [ ] Run focused Vitest tests and `pnpm --filter frontend type-check`.

### Task 4: Full verification and delivery

**Files:**
- Modify only files required by preceding test/format fixes.

- [ ] Run `cargo fmt --all --check`.
- [ ] Run `cargo clippy --workspace --all-targets --all-features -- -D warnings`.
- [ ] Run `cargo test --workspace`.
- [ ] Run `pnpm --filter frontend check`.
- [ ] Review `git diff --check`, changed-file sizes, and issue acceptance criteria.
- [ ] Run `/code-review` against `main`; fix valid findings and rerun affected verification.
- [ ] Commit implementation on `codex/issue-67-budget-rules`.
- [ ] Push branch and open a PR linked to issue #67 with concise summary and verification list.
