# Cash Flow budget integration research

Research for [Research Cash Flow integration for budgets](https://github.com/mastro993/zai-app/issues/42).

## Existing language and records

- Use **Cash flow**, **category**, **root category**, and **child category** in the specification; these terms are already defined in [`CONTEXT.md`](../../CONTEXT.md). A category is a user-defined grouping for cash-flow transactions, not a synonym for a budget.
- Transactions are the only existing money records. They have an integer `amount`, a timezone-free `NaiveDateTime` `transaction_date`, a `transaction_type`, and an optional category foreign key. Categories have an optional `parent_id`; the database currently joins transactions to categories only. See [`crates/db/src/schema.rs`](../../crates/db/src/schema.rs) and [`crates/core/src/features/transactions/models.rs`](../../crates/core/src/features/transactions/models.rs).
- The frontend receives camel-case models. Transaction amounts are already represented as integer minor units, so a budget amount should use the same unit rather than a floating-point value. See [`apps/frontend/src/features/cash-flow/types/model.ts`](../../apps/frontend/src/features/cash-flow/types/model.ts) and [`apps/frontend/src/features/cash-flow/commands/transactions.ts`](../../apps/frontend/src/features/cash-flow/commands/transactions.ts).
- Transaction search can filter by a list of category IDs, by date range, and by transaction type. An omitted category filter differs from an empty one: empty means uncategorized transactions only. A budget calculation must therefore define its own category-scope semantics explicitly, including whether a selected parent includes its children. See [`crates/core/src/features/transactions/models.rs`](../../crates/core/src/features/transactions/models.rs) and [`apps/server/src/api/cash_flow/transactions.rs`](../../apps/server/src/api/cash_flow/transactions.rs).

## Required integration seams

The feature should follow the existing vertical slice:

```text
Cash Flow route/screen → feature command wrapper → invokeCommand
  → Tauri command or Axum route → ServiceContext service → Diesel repository/migration
```

- Frontend routes are TanStack file routes under [`apps/frontend/src/routes`](../../apps/frontend/src/routes), while Cash Flow UI is grouped under [`apps/frontend/src/features/cash-flow`](../../apps/frontend/src/features/cash-flow). Existing route loaders call feature command wrappers and use `CommandResult`, as in [`apps/frontend/src/routes/cash-flow.transactions.tsx`](../../apps/frontend/src/routes/cash-flow.transactions.tsx).
- Feature wrappers call `invokeCommand` and return `CommandResult<T>` rather than throwing. Place future budget commands beside [`apps/frontend/src/features/cash-flow/commands/transactions.ts`](../../apps/frontend/src/features/cash-flow/commands/transactions.ts); keep API/IPC transport invisible to screens.
- The Tauri boundary contains thin async commands and registers each command in [`apps/tauri/src/lib.rs`](../../apps/tauri/src/lib.rs). The analogous category and transaction command modules are [`apps/tauri/src/commands/transaction_categories.rs`](../../apps/tauri/src/commands/transaction_categories.rs) and [`apps/tauri/src/commands/transactions.rs`](../../apps/tauri/src/commands/transactions.rs).
- Web mode has a resource-oriented `/api/cash-flow` router. Cash Flow routers compose in [`apps/server/src/api/cash_flow/mod.rs`](../../apps/server/src/api/cash_flow/mod.rs), and handlers call `ServiceContext` directly in [`apps/server/src/api/cash_flow/categories.rs`](../../apps/server/src/api/cash_flow/categories.rs) and [`apps/server/src/api/cash_flow/transactions.rs`](../../apps/server/src/api/cash_flow/transactions.rs).
- `ServiceContext` owns the current category and transaction service traits and is constructed in [`crates/app/src/lib.rs`](../../crates/app/src/lib.rs). A budget service and repository should be added there rather than embedding business rules in either UI transport.
- Database records, schema, repositories, and migrations live in [`crates/db`](../../crates/db); the existing category and transaction repository seams are exposed from [`crates/db/src/connection.rs`](../../crates/db/src/connection.rs). A budget feature consequently needs its own migration, schema entry, repository, and connection accessor, plus a service owned by `ServiceContext`.

## Constraints for the eventual specification

1. Persist category references by ID and decide the effects of category deletion/re-parenting before choosing foreign-key/delete behaviour. Existing categories already expose explicit child-delete strategies in [`crates/core/src/features/transaction_categories/models.rs`](../../crates/core/src/features/transaction_categories/models.rs); the lifecycle decision must say whether a budget is blocked, archived, changed, or removed in each case.
2. Specify calculation dates in the same timezone-free local calendar model used by transaction records, and make every period boundary inclusive/exclusive rule testable. The present transaction REST contract documents this shape in [`docs/wayfinder/cash-flow-rest-endpoints.md`](cash-flow-rest-endpoints.md).
3. Define an explicit read model for a budget period (configured amount, qualifying actual amount, rollover input/output, and status). Existing transaction list pagination is not a budget summary API and should not be used as the final UI contract.
4. Preserve Tauri/web parity: new command names, Tauri registrations, and web routes should be tested together. [`apps/frontend/src/features/cash-flow/commands/__tests__/cash-flow-command-parity.test.ts`](../../apps/frontend/src/features/cash-flow/commands/__tests__/cash-flow-command-parity.test.ts) enforces this for the existing Cash Flow wrappers.

## Verification patterns

- Put pure period, scope, and rollover rules in focused Rust unit tests beside the budget service/model, matching the existing core service structure in [`crates/core/src/features/transactions/service.rs`](../../crates/core/src/features/transactions/service.rs).
- Use Axum integration tests with an isolated application/database for budget routes, following [`apps/server/tests/transactions.rs`](../../apps/server/tests/transactions.rs) and [`apps/server/tests/transactions_list_filters.rs`](../../apps/server/tests/transactions_list_filters.rs). Cover CRUD, category integrity, boundary dates, rollover chains, past-transaction edits, and error status/body parity.
- Add Vitest tests adjacent to budget command helpers and pure frontend formatting/calculation helpers; existing Cash Flow command and library tests live under [`apps/frontend/src/features/cash-flow/commands/__tests__`](../../apps/frontend/src/features/cash-flow/commands/__tests__) and [`apps/frontend/src/features/cash-flow/lib/__tests__`](../../apps/frontend/src/features/cash-flow/lib/__tests__).

## No new decision ticket

The current map already contains the required open decisions: lifecycle/category integrity and balance/rollover rules. The UI prototype is correctly blocked on both of them and this research. The map's existing fog covers the detailed data model, API, migration plan, and verification matrix, so this research does not make a further question precise enough to ticket yet.
