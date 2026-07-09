# Cash Flow REST Endpoints

Research note for [Design REST endpoints for current Cash flow commands](https://github.com/mastro993/zai-app/issues/17).

## Question

What REST route, method, payload, status, and error contract should cover the current Cash flow category and transaction commands, including pagination, filters, sorting, imports, and import batches, while preserving frontend `CommandResult<T>` semantics?

## Decision

Add a small JSON API under `/api/cash-flow`, backed by thin Axum handlers that call the shared `ServiceContext` services. The frontend web transport should keep `invokeCommand<T>(command, args): CommandResult<T>` and map command names to these routes internally; feature code should not import URLs or know whether the runtime is Tauri IPC or REST.

Do not add a generic `/commands/:name` endpoint. Use normal resource routes where they stay clear, and use small action routes only for existing command-shaped operations such as bulk delete and import.

Do not add OpenAPI, generated clients, or generated command metadata for the first web mode. The current command surface is small enough for a handwritten, typed command map, and parity tests can keep it honest.

Do not add event streams or background-job endpoints for the current Cash flow contract. Every current category and transaction command is request/response.

## Shared Shapes

Responses should use the same camelCase JSON shapes already used by the Tauri command boundary.

```ts
interface TransactionCategory {
  id: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  parent?: TransactionCategory | null;
}

interface CategoryPayload {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
}

type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";

interface Transaction {
  id: string;
  description?: string | null;
  amount: number;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
}

interface TransactionPayload {
  id?: string;
  description?: string | null;
  amount: number;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
}

interface PaginatedData<T> {
  data: Array<T>;
  page: number;
  perPage: number;
  totalPages: number;
}

interface ApiError {
  message: string;
}
```

`transactionDate`, `startDate`, and `endDate` should keep the current timezone-free `NaiveDateTime` string shape, for example `2026-07-09T12:30:00`.

## Category Endpoints

| Command | Route | Request | Success |
| --- | --- | --- | --- |
| `get_transaction_categories` | `GET /api/cash-flow/categories?parentId=<id>` | `parentId` omitted means all non-deleted categories. Present `parentId` filters to direct children. | `200` with `Array<TransactionCategory>` |
| `get_transaction_category` | `GET /api/cash-flow/categories/:categoryId` | Path id. | `200` with `TransactionCategory` |
| `create_transaction_category` | `POST /api/cash-flow/categories` | `CategoryPayload` body. `id` may be omitted so core generates it. | `201` with `TransactionCategory` |
| `update_transaction_category` | `PUT /api/cash-flow/categories/:categoryId` | `CategoryPayload` body without relying on body `id`; handler builds `TransactionCategoryUpdate` from path id plus body. | `200` with `TransactionCategory` |
| `delete_transaction_categories` | `POST /api/cash-flow/categories/bulk-delete` | `{ "categoryIds": string[], "childrenStrategy"?: CategoryChildrenDeleteStrategy }`; default strategy is `block`. | `200` with deleted `Array<TransactionCategory>` |
| `import_transaction_categories` | `POST /api/cash-flow/categories/import` | `{ "categories": CategoryPayload[] }` | `200` with imported `Array<TransactionCategory>` |

Deletes should not return `204`, because current commands return the deleted model data and the frontend expects a JSON value.

## Transaction Endpoints

| Command | Route | Request | Success |
| --- | --- | --- | --- |
| `get_transactions` | `GET /api/cash-flow/transactions` | Query params described below. | `200` with `PaginatedData<Transaction>` |
| `get_transaction` | `GET /api/cash-flow/transactions/:transactionId` | Path id. | `200` with `Transaction` |
| `create_transaction` | `POST /api/cash-flow/transactions` | `TransactionPayload` body. `id` may be omitted so core generates it. | `201` with `Transaction` |
| `update_transaction` | `PUT /api/cash-flow/transactions/:transactionId` | `TransactionPayload` body without relying on body `id`; handler builds `TransactionUpdate` from path id plus body. | `200` with `Transaction` |
| `delete_transaction` | `DELETE /api/cash-flow/transactions/:transactionId` | Path id. | `200` with deleted `Transaction` |
| `delete_transactions` | `POST /api/cash-flow/transactions/bulk-delete` | `{ "transactionIds": string[] }` | `200` with deleted `Array<Transaction>` |
| `import_transactions` | `POST /api/cash-flow/transactions/import` | `{ "transactions": TransactionPayload[] }` | `200` with imported `Array<Transaction>` |
| `import_transaction_batch` | `POST /api/cash-flow/transactions/import-batch` | `{ "categories": CategoryPayload[], "transactions": TransactionPayload[] }` | `200` with imported `Array<Transaction>` |

`import_transaction_batch` should keep the current Tauri return shape: the service may create categories and transactions atomically, but the command returns only imported transactions.

### Transaction List Query

`GET /api/cash-flow/transactions` should map query params into the current `get_transactions(page, perPage, filters, sort)` command shape:

| Query param | Mapping |
| --- | --- |
| `page` | `page`, default `1` for direct REST calls |
| `perPage` | `perPage`, default `50` for direct REST calls |
| `query` | `filters.query` |
| `transactionType` | `filters.transactionType` |
| `startDate` | `filters.startDate` |
| `endDate` | `filters.endDate` |
| `categoryId` repeated | non-empty `filters.categories` |
| `uncategorized=true` | empty `filters.categories`, meaning transactions with no category |
| `sortField` | `sort.field` |
| `sortDesc` | `sort.desc`; default `false` when `sortField` is present |

`uncategorized=true` should not be combined with `categoryId`. If both appear, return `400` with `{ "message": "Choose either category filters or uncategorized only" }`.

Sorting should preserve current repository behavior: known fields are `description`, `type`, `amount`, and `date`; unknown fields fall back to date descending in the shared repository. If stricter sort validation is desired later, it should be added to the shared core path so Tauri and web behave the same.

## Error Contract

All failed REST responses should be JSON:

```json
{ "message": "Failed to create transaction: Invalid data: Invalid transaction type: transfer" }
```

Use one error body shape for every non-2xx status. Do not return stack traces, SQL details, or financial data.

Status mapping:

| Status | Use for |
| --- | --- |
| `400` | malformed JSON, invalid query parameters, invalid dates, incompatible filters, and `zai_core::Error::InvalidData` |
| `404` | `zai_core::Error::NotFound` and `DatabaseError::NotFound` |
| `409` | structural database conflicts such as unique or foreign-key violations |
| `500` | unexpected repository, pool, migration, or internal failures |

Handlers should keep the current command-level context in messages where practical, such as `Failed to load transactions: ...` or `Failed to import transaction batch: ...`, because those messages become `CommandError.message` in the web frontend.

The web `invokeCommand` implementation should:

- Return `Result.succeed(parsedJson)` for 2xx responses.
- Parse `{ message }` for non-2xx responses and return `Result.fail(new CommandError(message))`.
- Fall back to a status-derived message if the error body is missing or malformed.
- Wrap network and JSON parsing failures as `CommandError` using the same `toCommandError` helper style as the Tauri transport.

This preserves `CommandResult<T>` semantics: feature wrappers still await a result and branch with `Result.isFailure` instead of throwing or catching transport exceptions.

## Command Map

The web command map should be the only place that translates Tauri-style command args into REST requests:

| Command | Web transport mapping |
| --- | --- |
| `get_transaction_categories` | `GET /categories`, passing `parentId` only when non-null |
| `get_transaction_category` | `GET /categories/:categoryId` |
| `create_transaction_category` | `POST /categories` with `args.newCategory` |
| `update_transaction_category` | `PUT /categories/:id` with `args.updatedCategory` minus path id |
| `delete_transaction_categories` | `POST /categories/bulk-delete` with `categoryIds` and `childrenStrategy` |
| `import_transaction_categories` | `POST /categories/import` with `categories` |
| `get_transactions` | `GET /transactions`, expanding page, perPage, filters, and sort into query params |
| `get_transaction` | `GET /transactions/:transactionId` |
| `create_transaction` | `POST /transactions` with `args.newTransaction` |
| `update_transaction` | `PUT /transactions/:id` with `args.updatedTransaction` minus path id |
| `delete_transaction` | `DELETE /transactions/:transactionId` |
| `delete_transactions` | `POST /transactions/bulk-delete` with `transactionIds` |
| `import_transactions` | `POST /transactions/import` with `transactions` |
| `import_transaction_batch` | `POST /transactions/import-batch` with `categories` and `transactions` |

The route prefix `/api/cash-flow` can be held in the web transport base URL, so the table above can stay compact in code.

## Out of Scope for This Contract

CSV file selection and save dialogs are file capability concerns, not server data endpoints. `openCategoryImportFile`, `openTransactionImportFile`, `exportCategories`, and `exportTransactions` should be handled by [Decide web file import behavior](https://github.com/mastro993/zai-app/issues/18) and any later export fallback decision.

Server static asset serving, Docker packaging, and production packaging are not part of this endpoint contract.

## Effects on Later Tickets

[Decide web file import behavior](https://github.com/mastro993/zai-app/issues/18) can assume the persistence side of imports is JSON arrays of already-parsed `CategoryPayload` and `TransactionPayload` values.

[Define the web mode verification matrix](https://github.com/mastro993/zai-app/issues/19) should include:

- command parity across Tauri IPC registration and the web command map,
- route tests for every endpoint above,
- tests for transaction list query translation, including uncategorized-only filtering,
- tests that non-2xx JSON `{ message }` becomes `CommandError.message`,
- tests that delete and import endpoints return JSON values rather than `204`.

No new Wayfinder tickets are needed from this endpoint decision.

## Sources

- `apps/frontend/src/commands/shared.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-categories.ts`
- `apps/frontend/src/features/cash-flow/commands/transactions.ts`
- `apps/frontend/src/features/cash-flow/commands/category-import.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-import.ts`
- `apps/frontend/src/features/cash-flow/commands/category-export.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-export.ts`
- `apps/frontend/src/features/cash-flow/lib/category-import.ts`
- `apps/frontend/src/features/cash-flow/lib/transaction-import.ts`
- `apps/frontend/src/features/cash-flow/types/model.ts`
- `apps/tauri/src/commands/transaction_categories.rs`
- `apps/tauri/src/commands/transactions.rs`
- `apps/tauri/src/lib.rs`
- `crates/core/src/errors.rs`
- `crates/core/src/features/transaction_categories/models.rs`
- `crates/core/src/features/transaction_categories/service.rs`
- `crates/core/src/features/transactions/models.rs`
- `crates/core/src/features/transactions/service.rs`
- `crates/core/src/query.rs`
- `crates/db/src/errors.rs`
- `crates/db/src/pagination.rs`
- `crates/db/src/transaction_categories/repository.rs`
- `crates/db/src/transactions/repository.rs`
