# Plan 001: Establish a Green Verification Baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86edd88..HEAD -- package.json .github/workflows .github/frontend.instructions.md .github/copilot-instructions.md src/components/AppSidebar.tsx src/components/DatePicker.tsx src/components/navigation.tsx src/components/ThemeToggle.tsx src/lib/storage.ts src/main.tsx src/features/transaction-category/components/TransactionCategoryExportDialog.tsx src/routes/support/index.tsx src/routes/documentation/index.tsx src/routes/budgets/index.tsx src/routes/accounts/index.tsx src/routes/portfolio/index.tsx src/features/transaction/components/TransactionsList.tsx src/routes/settings/playgrounds/index.tsx src/routes/transactions/tags/index.tsx src/components/ThemeProvider.tsx src/features/transaction-category/components/TransactionCategoryList.tsx src/components/ui/form.tsx src/components/ui/sidebar.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `86edd88`, 2026-06-11

## Why this matters

The repo's own agent guidance says `pnpm lint` and `pnpm tsc:check` must pass before work is complete, but both commands currently fail. There is also no PR workflow that runs frontend or Rust checks, so regressions depend on local discipline. This plan creates a trustworthy baseline first, so security and transaction fixes can land behind machine-checkable gates.

## Current state

- `package.json` — declares the package manager and available scripts. It has `lint`, `tsc:check`, `format:check`, and `build`, but no one-command `check` or `test`.
- `.github/workflows/publish.yml` — the only workflow found; it is manual-only and does not run checks on pull requests.
- `AGENTS.md` — requires `pnpm lint` and `pnpm tsc:check` before completing tasks.
- The advisor ran `pnpm tsc:check` at commit `86edd88`; it failed with type errors in `AppSidebar.tsx`, `DatePicker.tsx`, `navigation.tsx`, `ThemeToggle.tsx`, and `storage.ts`.
- The advisor ran `pnpm lint`; it failed with 10 errors and 16 warnings across route placeholders, list keys, context values, playground logging, and hook dependencies.
- The advisor ran `cargo test --workspace`; it did not reach Rust test results in the sandbox because `libsqlite3-sys` failed its build script with a permission error. Do not treat that sandbox result as proof that Rust tests fail.

Relevant excerpts:

```json
// package.json:6-18
"scripts": {
  "generate-routes": "tsr generate",
  "watch-routes": "tsr watch",
  "dev": "vite",
  "build": "pnpm generate-routes && tsc && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "clean-db": "node scripts/clean-db.ts",
  "migrate:latest": "pnpm src/database/migrate.ts",
  "tsc:check": "tsc --noEmit",
  "lint": "oxlint",
  "format": "oxfmt src",
  "format:check": "oxfmt src --check"
}
```

```yaml
# .github/workflows/publish.yml:3-4
on:
  workflow_dispatch:
```

```markdown
<!-- AGENTS.md:17-21 -->
- [Frontend conventions](docs/frontend.md) — React, TypeScript, styling
- [Backend conventions](docs/backend.md) — Rust, Diesel, async patterns
- Always run pnpm lint and pnpm tsc:check before considering any task completed
- Always check HeroUI components before creating a new one from scratch
- Always use Hugeicons for icons
```

Repo conventions to match:

- Package manager is `pnpm@10.33.0`; do not introduce npm or yarn.
- Frontend checks are `pnpm lint` and `pnpm tsc:check`.
- Rust workspace checks should run from the repo root, which contains `Cargo.toml` with members `src-core` and `src-tauri`.
- Recent commit messages use conventional-style subjects such as `feat: category form`, `fix: service test`, and `refactor: update linting configuration and improve type imports across the project`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install JS deps if needed | `pnpm install` | exit 0 |
| Frontend typecheck | `pnpm tsc:check` | exit 0, no TypeScript errors |
| Frontend lint | `pnpm lint` | exit 0, no lint errors |
| Frontend format check | `pnpm format:check` | exit 0 |
| Rust check | `cargo check --workspace` | exit 0 |
| Rust tests | `cargo test --workspace` | exit 0; existing Rust tests pass |
| Full baseline | `pnpm check` | exit 0; all chained checks pass |

## Scope

**In scope**:

- `package.json`
- `.github/workflows/ci.yml` (create)
- `.github/workflows/publish.yml` only if needed to share setup conventions, not to fix publishing behavior in this plan
- Files currently blocking `pnpm tsc:check` and `pnpm lint`, limited to:
  - `src/components/AppSidebar.tsx`
  - `src/components/DatePicker.tsx`
  - `src/components/navigation.tsx`
  - `src/components/ThemeToggle.tsx`
  - `src/lib/storage.ts`
  - `src/main.tsx`
  - `src/features/transaction-category/components/TransactionCategoryExportDialog.tsx`
  - `src/routes/support/index.tsx`
  - `src/routes/documentation/index.tsx`
  - `src/routes/budgets/index.tsx`
  - `src/routes/accounts/index.tsx`
  - `src/routes/portfolio/index.tsx`
  - `src/features/transaction/components/TransactionsList.tsx`
  - `src/routes/settings/playgrounds/index.tsx`
  - `src/routes/transactions/tags/index.tsx`
  - `src/components/ThemeProvider.tsx`
  - `src/features/transaction-category/components/TransactionCategoryList.tsx`
  - `src/components/ui/form.tsx`
  - `src/components/ui/sidebar.tsx`

**Out of scope**:

- Implementing real transaction persistence; that belongs to `plans/004-finish-transactions-vertical-slice.md`.
- Removing the Stronghold playground or devtools; that belongs to `plans/003-gate-production-debug-surfaces.md`.
- Changing Rust business logic or database schema.
- Running formatters across the entire repo unless needed for touched files.

## Git workflow

- Branch: `advisor/001-establish-verification-baseline`
- Commit message style: use conventional commits, for example `chore: establish verification baseline`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add a single verification script

Add a `check` script to `package.json` that chains the existing frontend checks and Rust workspace checks. Keep the existing scripts. A suitable first version is:

```json
"check": "pnpm tsc:check && pnpm lint && pnpm format:check && cargo check --workspace && cargo test --workspace"
```

Do not include `pnpm build` in `check` yet unless the project owner wants the slower route-generation/build gate on every PR.

**Verify**: `pnpm check` → expected to fail at this point because existing type/lint errors have not been fixed yet.

### Step 2: Fix TypeScript failures without feature work

Run `pnpm tsc:check` and fix only the reported type errors.

Known failures at planning time:

- `src/components/AppSidebar.tsx` and `src/components/navigation.tsx` import `IconSvgElement` from `@hugeicons/core-free-icons`, but that export is not available. Prefer deriving the icon type from the local `Icon` component props or another existing Hugeicons type available in the installed package.
- `src/components/AppSidebar.tsx` passes `asChild` to `SidebarMenuButton`, but the component type does not accept `asChild`. Adjust usage to match `src/components/ui/sidebar.tsx` rather than weakening types with `any`.
- `src/components/DatePicker.tsx` passes `isDisabled` to `RangeCalendarCell`, but the prop type does not accept it. Use the HeroUI v3-supported disabled/unavailable date API instead.
- `src/components/navigation.tsx` passes `placement` to `Tooltip.Trigger`, but the prop type does not accept it. Move placement to the correct HeroUI tooltip component if supported, or remove it.
- `src/components/ThemeToggle.tsx` uses `variant="bordered"`, which is not one of this repo's button variants.
- `src/lib/storage.ts` constructs `new LazyStore("store.json", { autoSave: 1000 })`, but the installed `StoreOptions` requires `defaults`. Supply an explicit `defaults` value or follow the current plugin API.

Keep fixes minimal. Do not replace component libraries or refactor unrelated UI.

**Verify**: `pnpm tsc:check` → exit 0, no TypeScript errors.

### Step 3: Fix lint errors and warnings that fail the gate

Run `pnpm lint` and fix all errors. Also fix warnings in files you touch when the fix is mechanical.

Known lint blockers at planning time:

- Placeholder route text in `src/routes/accounts/index.tsx`, `src/routes/budgets/index.tsx`, and `src/routes/portfolio/index.tsx` contains unescaped quotes.
- `src/features/transaction/components/TransactionsList.tsx` puts `key` on `JsonDisplay`, not the `<li>`, and uses an array index key.
- `src/components/ThemeProvider.tsx` and `src/components/ui/form.tsx` construct context values inline.
- `src/routes/transactions/tags/index.tsx` has a useless fragment around each row.
- `src/routes/settings/playgrounds/index.tsx` has `console.error` calls and variable shadowing.
- `src/routes/support/index.tsx` and `src/routes/documentation/index.tsx` use an iframe sandbox combination flagged by the linter.
- `src/main.tsx` uses a non-null assertion for `document.getElementById("root")`.

Do not silence rules with broad disable comments. A narrow inline disable is acceptable only when the repository already uses that exact pattern and a type-safe alternative is not available.

**Verify**: `pnpm lint` → exit 0, no lint errors or warnings.

### Step 4: Add a PR CI workflow

Create `.github/workflows/ci.yml` with a PR/push workflow that runs on `main` and uses pnpm. Keep it modest and aligned with local gates:

- checkout
- setup Node LTS with pnpm cache
- enable Corepack
- install dependencies with `pnpm install --frozen-lockfile`
- setup Rust stable
- install Linux system dependencies required by Tauri/Rust checks if the job runs on Ubuntu
- run `pnpm check`

Use `pnpm`, not Yarn. The existing publish workflow currently uses Yarn; do not fix that here unless it breaks shared setup or the owner asks. That is covered by the earlier audit but not selected for planning.

**Verify**: `pnpm check` locally → exit 0.

### Step 5: Confirm Rust checks outside the sandbox if needed

Run `cargo check --workspace` and `cargo test --workspace`. If `libsqlite3-sys` fails with the same sandbox-only permission error, rerun outside the restricted sandbox or ask the operator to run it locally. Do not mark this plan done until Rust checks have a real pass or a documented environment blocker.

**Verify**: `cargo test --workspace` → exit 0, existing Rust tests pass.

## Test plan

This plan is mostly verification infrastructure. It should not add application behavior tests.

- Add no new frontend test runner in this plan unless the operator explicitly asks; that is separate from getting existing gates green.
- Add no Rust tests in this plan unless a minimal test is required to make `cargo test --workspace` meaningful after a tooling change.
- Verification is the test plan: `pnpm tsc:check`, `pnpm lint`, `pnpm format:check`, `cargo check --workspace`, `cargo test --workspace`, and `pnpm check` must all pass.

## Done criteria

- [x] `pnpm tsc:check` exits 0.
- [x] `pnpm lint` exits 0.
- [x] `pnpm format:check` exits 0.
- [x] `cargo check --workspace` exits 0.
- [x] `cargo test --workspace` exits 0, or a real non-code environment blocker is documented for the reviewer.
- [x] `pnpm check` exists and exits 0 in a normal development environment.
- [x] `.github/workflows/ci.yml` exists and runs the same core checks on PRs.
- [x] No feature behavior was changed beyond the minimal code edits needed to satisfy type/lint gates.
- [x] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Any current-state excerpt no longer matches the live code.
- Fixing a type or lint error appears to require changing the transaction feature behavior. That belongs to Plan 004.
- `pnpm check` requires installing new test frameworks or restructuring CI beyond a simple PR workflow.
- Rust checks fail because of actual compile/test failures in business logic rather than the known sandbox `libsqlite3-sys` permission issue.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Future plans depend on this baseline. Reviewers should scrutinize this PR for accidental behavior changes hidden inside "lint fixes", especially in `AppSidebar.tsx`, `DatePicker.tsx`, and any route components. Once this lands, every subsequent plan should use `pnpm check` as its final gate.
