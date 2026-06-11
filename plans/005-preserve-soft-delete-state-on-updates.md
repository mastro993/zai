# Plan 005: Preserve Soft-Delete State on Updates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86edd88..HEAD -- src-core/src/features/transactions/transactions_models.rs src-core/src/features/transactions/transactions_repository.rs src-core/src/features/transaction_categories/transaction_categories_models.rs src-core/src/features/transaction_categories/transaction_categories_repository.rs src-core/src/errors.rs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/001-establish-verification-baseline.md`
- **Category**: bug
- **Planned at**: commit `86edd88`, 2026-06-11

## Why this matters

Transactions and categories use soft deletes via `deleted_at`, and list/get queries hide rows where `deleted_at` is not null. Update paths currently build a full row changeset where `deleted_at` is reset to `None`, then write that row back. That can silently resurrect deleted financial records or categories when an update races with, or is sent after, deletion.

## Current state

- `src-core/src/features/transactions/transactions_models.rs` — `TransactionUpdate` converts into `TransactionRow` with `deleted_at: None`.
- `src-core/src/features/transactions/transactions_repository.rs` — `update_transaction` loads the existing row, preserves `created_at`, but does not preserve or check `deleted_at`.
- `src-core/src/features/transaction_categories/transaction_categories_models.rs` — `TransactionCategoryUpdate` converts into `TransactionCategoryRow` with `deleted_at: None`.
- `src-core/src/features/transaction_categories/transaction_categories_repository.rs` — `update_category` loads the existing row, preserves `created_at`, but does not preserve or check `deleted_at`.
- Existing repository tests cover normal update paths but not update-after-delete behavior.

Relevant excerpts:

```rust
// src-core/src/features/transactions/transactions_models.rs:142-156
impl From<TransactionUpdate> for TransactionRow {
    fn from(value: TransactionUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            description: value.description,
            amount: value.amount,
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}
```

```rust
// src-core/src/features/transactions/transactions_repository.rs:178-194
self.writer
    .exec(move |conn: &mut SqliteConnection| -> Result<Transaction> {
        let mut transaction: TransactionRow = updated_transaction.into();

        let existing = transactions::table
            .find(&transaction.id)
            .first::<TransactionRow>(conn)
            .map_err(|e| Error::NotFound(e.to_string()))?;

        transaction.created_at = existing.created_at;
        transaction.updated_at = chrono::Utc::now().naive_utc();

        diesel::update(transactions::table.find(&transaction.id))
            .set(&transaction)
            .execute(conn)?;

        Ok(transaction.into())
    })
```

```rust
// src-core/src/features/transaction_categories/transaction_categories_models.rs:161-173
impl From<TransactionCategoryUpdate> for TransactionCategoryRow {
    fn from(value: TransactionCategoryUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}
```

```rust
// src-core/src/features/transaction_categories/transaction_categories_repository.rs:189-199
let existing = transaction_categories::table
    .find(&category.id)
    .first::<TransactionCategoryRow>(conn)
    .map_err(|e| Error::NotFound(e.to_string()))?;

category.created_at = existing.created_at;
category.updated_at = chrono::Utc::now().naive_utc();

diesel::update(transaction_categories::table.find(&category.id))
    .set(&category)
    .execute(conn)?;
```

Repo conventions to match:

- Repository methods return `crate::errors::Result`.
- Validation failures use `Error::InvalidData(String)`; missing rows use `Error::NotFound(String)`.
- Async database writes go through `WriteHandle.exec()`.
- Category repository tests use `TempDb`, `run_migrations`, and `spawn_writer`; reuse that structure.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Rust tests | `cargo test --workspace` | exit 0 |
| Rust check | `cargo check --workspace` | exit 0 |
| Typecheck | `pnpm tsc:check` | exit 0 if frontend unaffected |
| Lint | `pnpm lint` | exit 0 if frontend unaffected |
| Full baseline after Plan 001 | `pnpm check` | exit 0 |

## Scope

**In scope**:

- `src-core/src/features/transactions/transactions_repository.rs`
- `src-core/src/features/transactions/transactions_models.rs` only if needed
- `src-core/src/features/transaction_categories/transaction_categories_repository.rs`
- `src-core/src/features/transaction_categories/transaction_categories_models.rs` only if needed
- Rust tests in the same modules
- `src-core/src/errors.rs` only if a new specific error variant is clearly needed

**Out of scope**:

- Parent-category delete cascade/reparent policy. That was a separate audit finding and is not selected here.
- Import skipped-row behavior.
- Frontend transaction vertical slice.
- Hard-delete support.
- Database schema changes.

## Git workflow

- Branch: `advisor/005-preserve-soft-delete-state`
- Commit message style: `fix: preserve soft-delete state on updates`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Decide update policy for soft-deleted rows

Use this policy unless the maintainer explicitly says otherwise:

- Updating a soft-deleted row should fail as not found.
- Do not use update-as-undelete behavior.
- Future undelete, if needed, should be an explicit command/method.

This matches existing read behavior: `get_transaction` and `get_category` filter `deleted_at.is_null()`.

**Verify**: no command; document the chosen policy in the PR summary.

### Step 2: Add failing category regression test first

In `src-core/src/features/transaction_categories/transaction_categories_repository.rs`, add a test near the existing update/delete tests:

1. Create a category.
2. Delete it with `delete_categories`.
3. Attempt `update_category` using the deleted category id.
4. Assert the update returns `Err`.
5. Assert `get_categories(None)` does not include the category.

Use the existing `setup_test_repo` helper in that file.

**Verify**: `cargo test -p zai-core transaction_categories` → the new test should fail before the fix, proving the regression is covered.

### Step 3: Fix category update

In `update_category`, after loading `existing`, reject soft-deleted rows:

```rust
if existing.deleted_at.is_some() {
    return Err(Error::NotFound("Transaction category not found".to_string()));
}
```

Alternatively, add `.filter(transaction_categories::deleted_at.is_null())` to the load query. If using the filter approach, keep the error mapping to `Error::NotFound`.

Also ensure the row being updated cannot reset `deleted_at` accidentally. Either preserve `category.deleted_at = existing.deleted_at` before `.set(&category)`, or use a changeset type that does not include `deleted_at`. The safer long-term shape is a dedicated update changeset that only includes user-editable fields plus `updated_at`.

For this plan, the minimal acceptable fix is:

- reject existing deleted rows
- preserve `deleted_at` when setting the changeset

**Verify**: `cargo test -p zai-core transaction_categories` → category tests pass.

### Step 4: Add transaction regression test

If Plan 004 has already added transaction repository tests, add a transaction update-after-delete regression there:

1. Create a transaction.
2. Delete it with `delete_transaction`.
3. Attempt `update_transaction`.
4. Assert the update returns `Err`.
5. Assert `get_transaction` returns `Err`.

If Plan 004 has not landed and there is still no transaction test harness, create the smallest harness copied from category repository tests. Keep it local to `transactions_repository.rs`.

**Verify**: `cargo test -p zai-core transactions` → the new transaction test should fail before the transaction fix.

### Step 5: Fix transaction update

In `update_transaction`, apply the same policy as categories:

- Load only non-deleted existing rows, or explicitly reject `existing.deleted_at.is_some()`.
- Preserve `deleted_at` in any full-row changeset, or replace the full-row changeset with a dedicated changeset that cannot write `deleted_at`.

Do not change create/delete/list semantics.

**Verify**: `cargo test -p zai-core transactions` → transaction tests pass.

### Step 6: Run full verification

Run the complete relevant gate. If Plan 001 has landed, use `pnpm check`. Otherwise run Rust and frontend checks separately.

**Verify**: `cargo test --workspace && pnpm tsc:check && pnpm lint` → all exit 0.

## Test plan

- Add `test_update_soft_deleted_category_returns_not_found` or similarly named category repository test.
- Add `test_update_soft_deleted_transaction_returns_not_found` or similarly named transaction repository test.
- Existing normal update tests must continue passing.
- Optional extra assertion: after failed update, active list queries still exclude the deleted row.

## Done criteria

- [ ] Updating a soft-deleted category returns an error and does not reactivate it.
- [ ] Updating a soft-deleted transaction returns an error and does not reactivate it.
- [ ] Regression tests cover both entities.
- [ ] Normal update tests still pass.
- [ ] `cargo test --workspace` exits 0.
- [ ] `pnpm tsc:check` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] No schema or frontend behavior changes are introduced.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The code at the current-state excerpts no longer matches.
- The maintainer wants update-as-undelete behavior; that requires a different explicit undelete design.
- Adding transaction tests requires broad setup work that overlaps heavily with Plan 004.
- Fixing this requires changing the database schema or public Tauri command shape.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

The deeper improvement is to avoid full-row `AsChangeset` structs for updates that should never write system fields (`created_at`, `deleted_at`). A reviewer should check whether the final diff merely preserves `deleted_at` or introduces narrower changesets; narrower changesets are better, but preserving and rejecting deleted rows is sufficient for this plan.
