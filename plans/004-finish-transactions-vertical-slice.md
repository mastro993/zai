# Plan 004: Finish the Transactions Vertical Slice

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86edd88..HEAD -- src-core/src/features/transactions src-tauri/src/commands/transactions.rs src-tauri/src/commands/mod.rs src-tauri/src/main.rs src/features/transaction src/routes/transactions/index.tsx src/lib/adapters.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/001-establish-verification-baseline.md`
- **Category**: direction
- **Planned at**: commit `86edd88`, 2026-06-11

## Why this matters

Transactions are the core personal-finance workflow, but the UI currently reports success without writing anything and always renders an empty list. The Rust core already has transaction models, repository methods, and a service trait, so the highest-leverage product improvement is to wire one complete read/create/list path end to end. This plan deliberately limits scope to the first usable vertical slice instead of building every transaction feature.

## Current state

- `src-core/src/features/transactions/transactions_models.rs` — defines `Transaction`, `NewTransaction`, `TransactionUpdate`, and search filters.
- `src-core/src/features/transactions/transactions_repository.rs` — implements `get_transactions`, `get_transaction`, `create_transaction`, update/delete/import methods.
- `src-core/src/features/transactions/transactions_service.rs` — delegates most methods but has `update_transactions` as `todo!()`.
- `src-tauri/src/commands/transactions.rs` — only exposes `get_transaction`.
- `src-tauri/src/main.rs` — registers category commands and only `commands::transactions::get_transaction`.
- `src/features/transaction/api/useAddTransaction.ts` — mutation ignores input, returns `[]`, and shows "Transaction added".
- `src/features/transaction/api/useTransactionList.ts` — query returns `{ data: [], page }`; starts at page 0.
- `src/features/transaction/components/TransactionAddButton.tsx` — sends a hardcoded demo object with frontend field names that do not match Rust.
- `src/features/transaction/components/TransactionsList.tsx` — renders raw JSON and has current lint issues around list keys.

Relevant excerpts:

```rust
// src-tauri/src/commands/transactions.rs:8-18
#[tauri::command]
pub async fn get_transaction(
    transaction_id: &str,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Transaction, String> {
    debug!("Getting transaction ...{}", transaction_id);
    state
        .transactions_service()
        .get_transaction(transaction_id)
        .map_err(|e| format!("Failed to load transaction: {}", e))
}
```

```rust
// src-tauri/src/main.rs:65-73
.invoke_handler(tauri::generate_handler![
    commands::transaction_categories::get_transaction_category,
    commands::transaction_categories::get_transaction_categories,
    commands::transaction_categories::create_transaction_category,
    commands::transaction_categories::update_transaction_category,
    commands::transaction_categories::delete_transaction_categories,
    commands::transaction_categories::import_transaction_categories,
    commands::transactions::get_transaction,
])
```

```typescript
// src/features/transaction/api/useAddTransaction.ts:7-14
return useMutation({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async mutationFn(_transaction: unknown) {
    return [];
  },
  async onSuccess() {
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    toast.success("Transaction added");
```

```typescript
// src/features/transaction/api/useTransactionList.ts:8-20
export const useTransactionList = () =>
  useInfiniteQuery<TransactionPage>({
    queryKey: ["transactions"],
    queryFn: async ({ pageParam = 0 }) => {
      const page = pageParam as number;

      return {
        data: [],
        page,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionPage) => lastPage.page + 1,
  });
```

```rust
// src-core/src/database/pagination.rs:22-29
impl<T> Paginate for T {
    fn paginate(self, page: i64) -> Paginated<Self> {
        Paginated {
            query: self,
            per_page: DEFAULT_PER_PAGE,
            page,
            offset: (page - 1) * DEFAULT_PER_PAGE,
        }
    }
}
```

Repo conventions to match:

- Frontend feature structure should mirror `src/features/transaction-category/`: `types.ts`, `commands.ts`, `queries/`, `mutations/`, `components/`, and route screen.
- Frontend command wrappers use `invokeTauri` and Zod parsing, as in `src/features/transaction-category/commands.ts`.
- Rust features follow models/traits/repository/service in `src-core`, then Tauri commands in `src-tauri/src/commands`.
- Mutations invalidate TanStack Query keys, as category mutations do.
- Rust structs use `#[serde(rename_all = "camelCase")]`, so TypeScript uses camelCase fields such as `transactionDate` and `transactionType`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `pnpm tsc:check` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Rust tests | `cargo test --workspace` | exit 0 |
| Full baseline after Plan 001 | `pnpm check` | exit 0 |
| Run app manually | `pnpm tauri dev` | app starts; transaction add/list can be exercised |

## Scope

**In scope**:

- `src-core/src/features/transactions/transactions_models.rs`
- `src-core/src/features/transactions/transactions_traits.rs`
- `src-core/src/features/transactions/transactions_repository.rs`
- `src-core/src/features/transactions/transactions_service.rs`
- New or existing Rust tests under `src-core/src/features/transactions/`
- `src-tauri/src/commands/transactions.rs`
- `src-tauri/src/commands/mod.rs` only if needed for module exports
- `src-tauri/src/main.rs`
- `src/features/transaction/types.ts` (create)
- `src/features/transaction/commands.ts` (create)
- `src/features/transaction/api/useAddTransaction.ts`
- `src/features/transaction/api/useTransactionList.ts`
- `src/features/transaction/components/TransactionAddButton.tsx`
- `src/features/transaction/components/TransactionsList.tsx`
- `src/routes/transactions/index.tsx` only if needed to pass data/props or improve first usable UI

**Out of scope**:

- Bulk update (`update_transactions`) unless it blocks compile/tests. It may be removed from the service trait or left unexposed if no caller needs it.
- Transaction edit/delete/import UI.
- Account support, budgets, portfolio, reports, or tags.
- Main database encryption.
- Major redesign of the transactions page.

## Git workflow

- Branch: `advisor/004-finish-transactions-vertical-slice`
- Commit message style: `feat: wire transactions vertical slice`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add Rust command coverage for list and create

In `src-tauri/src/commands/transactions.rs`, add commands for:

- `get_transactions(page, per_page, filters, sort, state) -> Result<PaginatedData<Transaction>, String>`
- `create_transaction(new_transaction, state) -> Result<Transaction, String>`

Use the existing transaction service methods. Keep errors user-safe but consistent with current command style. Register both commands in `src-tauri/src/main.rs`.

Be careful with `TransactionSearchFilters<'a>` because it borrows string slices. If Tauri command deserialization cannot support that shape, introduce a command-specific owned filter type and convert it to the core filter before calling the service. Do not fight lifetimes with unsafe casts.

**Verify**: `cargo check --workspace` → exit 0.

### Step 2: Add Rust characterization tests for transaction repository basics

Create tests in the transaction module following the category repository harness:

```rust
// src-core/src/features/transaction_categories/transaction_categories_repository.rs:303-313
fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
    let pool = Pool::builder()
        .build(manager)
        .expect("Failed to create pool");

    run_migrations(&pool.clone()).unwrap();

    let writer = spawn_writer(pool.clone());

    TransactionCategoriesRepository::new(Arc::new(pool), writer)
}
```

Add transaction tests for:

- create transaction persists and returns a non-empty id.
- get transaction returns a created transaction.
- get transactions returns page 1 with created records.
- page numbering starts at 1; do not use page 0.

Do not fix soft-delete resurrection here unless you are also executing Plan 005. If you discover a failing data-integrity bug covered by Plan 005, mark the test ignored or defer it to Plan 005 rather than broadening this plan.

**Verify**: `cargo test --workspace` → exit 0.

### Step 3: Add frontend transaction schemas and command wrappers

Create `src/features/transaction/types.ts` with Zod schemas matching Rust serde output:

- `TransactionSchema`
- `TransactionsPageSchema` matching `PaginatedData<Transaction>` fields: `data`, `page`, `perPage`, `totalPages`
- `NewTransactionSchema` or a form input type for create payloads

Create `src/features/transaction/commands.ts` modeled after `src/features/transaction-category/commands.ts`:

```typescript
// pattern only; do not copy category names
const result = await invokeTauri("get_transaction_categories", { parentId });
return TransactionCategoriesSchema.parse(result);
```

Expose at least:

- `getTransactions({ page, perPage })`
- `createTransaction(transaction)`

Use `transactionDate` and `transactionType`, not `date` and `type`, unless you explicitly map form names to Rust names in the command wrapper.

**Verify**: `pnpm tsc:check` → exit 0.

### Step 4: Replace stub React Query hooks

Update `useTransactionList`:

- Use `getTransactions`.
- Set `initialPageParam: 1`, because backend pagination is 1-based.
- Stop fetching next pages when `lastPage.page >= lastPage.totalPages`.
- Use typed transaction pages, not `any[]`.

Update `useAddTransaction`:

- Accept a typed new transaction payload.
- Call `createTransaction`.
- Invalidate `["transactions"]` on success.
- Keep the toast behavior.

**Verify**: `pnpm tsc:check` → exit 0.

### Step 5: Replace the hardcoded add demo with a minimal valid create path

`TransactionAddButton` currently sends:

```typescript
// src/features/transaction/components/TransactionAddButton.tsx:10-17
addTransaction({
  description: "Test",
  amount: 100,
  date: "2021-01-01",
  type: "income",
  notes: "Test",
});
```

Replace this with the smallest UI that creates a valid transaction. Acceptable options:

1. A minimal modal/form with fields for amount, transaction type, transaction date, description, notes, and optional category.
2. If the owner wants a smaller slice, keep the button but send a clearly valid typed sample only in development and label it as dev-only.

Prefer option 1 if feasible within the plan. Do not ship a production "Add transaction" button that inserts fake data.

**Verify**: `pnpm lint && pnpm tsc:check` → both exit 0.

### Step 6: Render the real transaction list

Update `TransactionsList` so it renders the typed transaction data, not only raw JSON. A minimal acceptable UI can be a simple list/table with:

- description or fallback text
- amount
- transaction type
- transaction date
- notes if present

Use a stable key: `transaction.id`.

Handle loading and empty states. You may use existing `EmptyView` or simple local markup. Keep UI polish modest; do not redesign the whole page.

**Verify**: `pnpm lint && pnpm tsc:check` → both exit 0.

### Step 7: Manual end-to-end check

Run the app and verify:

- Transactions page loads.
- Creating a transaction succeeds.
- The created transaction appears in the list without restarting.
- Restarting the app still shows the transaction.
- No page 0 request is made.

**Verify**: `pnpm tauri dev` manual check completed; record the scenario in the PR summary.

## Test plan

- Rust tests:
  - new transaction repository tests for create/get/list/page 1.
  - command-level tests only if the repo already has a reliable Tauri command test harness by execution time.
- Frontend tests:
  - If a test runner exists after Plan 001, add schema tests for `TransactionSchema` and `TransactionsPageSchema`.
  - If no test runner exists, rely on TypeScript plus manual Tauri verification.
- Final verification:
  - `cargo test --workspace`
  - `pnpm lint`
  - `pnpm tsc:check`
  - `pnpm check` if available

## Done criteria

- [ ] `get_transactions` and `create_transaction` Tauri commands exist and are registered.
- [ ] Frontend transaction command wrappers use `invokeTauri` and Zod parsing.
- [ ] `useTransactionList` fetches real backend pages and starts at page 1.
- [ ] `useAddTransaction` persists data and invalidates the transaction query.
- [ ] The add UI no longer reports success for a no-op mutation.
- [ ] `TransactionsList` renders persisted transactions with stable keys.
- [ ] New Rust tests cover create/get/list.
- [ ] `cargo test --workspace` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm tsc:check` exits 0.
- [ ] Manual Tauri verification confirms create/list/restart persistence.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The current-state excerpts no longer match.
- Tauri cannot deserialize the existing borrowed `TransactionSearchFilters<'a>` and the owned command DTO would require changing many core APIs.
- A real add-transaction form requires design/product decisions beyond basic fields.
- The transaction date format between TypeScript and `chrono::NaiveDateTime` cannot be resolved with a small serializer/parser.
- You need account support to create transactions. Accounts are out of scope.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

This plan makes transactions usable but intentionally leaves edit/delete/import and advanced filters for later. Reviewers should focus on IPC contract correctness, date serialization, page numbering, and whether the UI can accidentally create fake/demo data in production. Plan 005 should still run afterward to fix soft-delete resurrection in both categories and transactions.
