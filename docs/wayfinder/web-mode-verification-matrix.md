# Web Mode Verification Matrix

Research note for [Define the web mode verification matrix](https://github.com/mastro993/zai-app/issues/19).

## Question

What minimum automated checks prove Tauri IPC and web REST parity for the first web mode, including Rust server tests, frontend adapter tests, command registration/parity tests, route generation, and a browser smoke path?

## Decision

Use a small layered matrix instead of a broad end-to-end suite. The minimum proof is:

- Rust tests prove the Axum server routes, shared service context, error mapping, bind guard, and current Cash flow REST contract.
- Vitest tests prove build-target transport selection, Tauri IPC invocation, web REST command mapping, web error conversion, and file-capability adapters.
- One command parity test proves every backend command in the typed registry is registered by both Tauri IPC and the web command map, and behavioral parity tests compare HTTP and Tauri service outcomes for budgets, categories, transactions, and alerts.
- Existing TanStack route generation checks stay in CI and must remain part of the web-mode gate.
- One Chromium browser smoke test proves the browser can run against a local Axum server and complete a simple Cash flow path through REST and SQLite.

This is enough for first web mode because the command surface is small and already centered on Cash flow categories and transactions. It avoids OpenAPI, generated clients, full multi-browser E2E, and production packaging checks until the app has a real need.

## Test Matrix

| Layer | Check | Tool | Minimum coverage |
| --- | --- | --- | --- |
| Shared app composition | Shared context builds from a temporary app data directory and exposes category and transaction services | Rust unit or integration test in `crates/app` | `initialize_context` runs inside Tokio, creates SQLite, runs migrations, and both runtimes compile against `zai_app::ServiceContext` |
| Server config | Local-first server safety | Rust unit tests in `apps/server` | Default bind is `127.0.0.1`; non-loopback bind fails closed while no auth design exists; CORS is not wildcard credentials by default |
| REST routes | Current Cash flow route contract | Rust Axum tests with `tower::ServiceExt::oneshot` | Every route from the REST decision has at least one success test; delete and import endpoints return JSON values, not `204` |
| REST query mapping | Transaction list query semantics | Rust Axum tests | Pagination defaults, repeated `categoryId`, `uncategorized=true`, invalid `uncategorized` plus `categoryId`, date filters, transaction type, and sort params map to service filters |
| REST errors | HTTP error contract | Rust Axum tests | Malformed/invalid requests return `400`; missing rows return `404`; structural conflicts return `409`; all non-2xx responses use `{ "message": string }` without stack traces or sensitive data |
| Web command transport | Command-name to REST mapping | Vitest | Each current Cash flow command builds the expected method, URL, query string, and JSON body |
| Web command result semantics | `CommandResult<T>` is preserved | Vitest | 2xx JSON becomes `Result.succeed`; non-2xx `{ message }`, network failures, and malformed JSON become `Result.fail(new CommandError(...))` |
| Tauri command transport | Desktop implementation still invokes IPC | Vitest with mocked `@tauri-apps/api/core` | Tauri implementation passes command and args to `invoke`; rejected invocations become `CommandError` |
| Build-target selection | Wrong runtime cannot be selected silently | Vitest around a small config helper plus Vite build/type checks | `BUILD_TARGET=tauri` resolves the Tauri transport; `BUILD_TARGET=web` resolves the web transport; missing or unknown target fails loudly |
| Command parity | Frontend registry, Tauri, and web command registrations stay aligned | Vitest registry test plus Rust behavioral parity suites | Typed backend command names match Tauri `generate_handler!` registrations and web command-map keys; HTTP and Tauri bodies match for representative success and error cases across financial command families |
| File capability adapters | CSV import/export stays outside REST | Vitest | Desktop adapter wraps Tauri dialog/fs; web import adapter reads `File.text()` and returns runtime-neutral file metadata; no desktop path is required by shared UI |
| Route generation | Generated route tree is current | Existing `pnpm --filter frontend check:routes` | `tsr generate` leaves `apps/frontend/src/routeTree.gen.ts` unchanged |
| Browser smoke | Browser UI reaches REST-backed Cash flow data | Playwright Chromium smoke | Start Axum with a temp SQLite app data dir and Vite with `BUILD_TARGET=web`; visit one Cash flow route, load empty data, create or import one category, and verify it appears |

## Rust Server Checks

Add server tests when `apps/server` is introduced, preferably under `apps/server/tests/`.

The route tests should build a router from the same public function used by `main`, with `Arc<ServiceContext>` state created by the shared initializer. Use an isolated temporary app data directory per test so the server exercises migrations and repositories through SQLite rather than mocked persistence.

Minimum route coverage:

- Categories: list, get, create, update, bulk delete, import.
- Transactions: list, get, create, update, delete one, bulk delete, import, import batch.
- Transaction list query translation: page/perPage, query, transactionType, startDate/endDate, repeated category filters, uncategorized-only filtering, and incompatible filter rejection.
- JSON-returning destructive/action routes: `delete_transaction`, `delete_transactions`, `delete_transaction_categories`, `import_transaction_categories`, `import_transactions`, and `import_transaction_batch`.

Keep these as handler/route contract tests, not duplicated business-logic tests. The core and db crates already own model validation, service behavior, repository behavior, and migrations.

## Frontend Adapter Checks

Split command transport behind build-target-specific modules that both export `invokeCommand<T>(command, args): CommandResult<T>`.

Minimum web transport tests:

- Command map covers the fourteen current Cash flow backend commands:
  - `get_transaction_categories`
  - `get_transaction_category`
  - `create_transaction_category`
  - `update_transaction_category`
  - `delete_transaction_categories`
  - `import_transaction_categories`
  - `get_transactions`
  - `get_transaction`
  - `create_transaction`
  - `update_transaction`
  - `delete_transaction`
  - `delete_transactions`
  - `import_transactions`
  - `import_transaction_batch`
- `get_transactions` expands filters and sort into the REST query contract.
- Unknown commands fail as `CommandError` rather than falling through to a bad fetch.
- Non-2xx responses parse `{ message }` into `CommandError.message`.
- Missing or malformed error bodies fall back to a status-derived `CommandError`.
- Network failures and JSON parsing failures return failed `Result` values.

Minimum Tauri transport tests:

- The module imports `@tauri-apps/api/core` and delegates to `invoke(command, args)`.
- Rejected IPC calls are converted through the same `toCommandError` path.
- The desktop-only server-side guard for `typeof window === "undefined"` remains a failed `CommandResult`, not a thrown exception.

## Command Parity Check

Do not rely on human review to keep the command lists aligned.

Add one automated parity test that compares:

- command names referenced by frontend Cash flow command wrappers,
- command names registered in `apps/tauri/src/lib.rs` inside `tauri::generate_handler!`,
- keys exported by the web command map.

The first version can be a static source test that reads these files, because Tauri's `generate_handler!` macro is not easily introspected at runtime. If implementation later centralizes command names into a typed shared list, the test should compare against that list instead.

Explicitly exclude non-Cash-flow commands and file capabilities from this parity list:

- `get_stronghold_vault_password` is a desktop secret command, not part of the Cash flow REST surface.
- `openCategoryImportFile`, `openTransactionImportFile`, `exportCategories`, and `exportTransactions` are file-capability APIs, not backend data commands.

## Browser Smoke

Add exactly one browser smoke path for first web mode. Playwright with Chromium is enough.

The smoke should:

1. Start `apps/server` against a temporary app data directory.
2. Start Vite with `BUILD_TARGET=web` and an API target pointing to that server.
3. Visit `/cash-flow/categories` or `/cash-flow/transactions`.
4. Assert the route loads without Tauri globals.
5. Create or import one category through the UI and verify it is visible after a reload.

This proves the browser, Vite alias, web transport, REST route, shared service context, SQLite persistence, and TanStack route loader work together. It should not grow into exhaustive UI coverage.

## CI Gate

Keep the existing gates and add the web-specific ones only when their owning files exist:

- `pnpm check:frontend`
- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets --all-features -- -D warnings`
- `cargo test --workspace`
- `pnpm --filter frontend check:routes`
- `pnpm --filter frontend test`
- `pnpm test:e2e:web` or equivalent for the single Playwright smoke

Once `apps/server` exists, add it to the workspace so `cargo test --workspace` covers it. Once `crates/app` exists, its tests should also run under the same backend gate.

## Out of Scope

These checks are not required for first web mode:

- OpenAPI generation or generated client parity.
- Exhaustive browser coverage for every Cash flow CRUD path.
- Multi-browser Playwright matrix.
- Hosted, Docker, static asset serving, or production packaging checks.
- Remote authenticated access checks.
- Event stream or background-job checks.
- Multipart upload checks for CSV import.

## Effects on the Map

No new Wayfinder tickets are needed from this decision.

The remaining implementation can proceed as a normal feature plan because the map now has decisions for runtime model, command transport, shared service initialization, REST route shape, file import behavior, and verification.

Production packaging, Docker, static asset serving, hosted remote access, and future feature-specific desktop-only fallbacks should stay outside this first web-mode plan unless the destination is redrawn.

## Sources

- [Wayfinder: Run Zai on the web](https://github.com/mastro993/zai-app/issues/12)
- [Research Wealthfolio's web mode fit for Zai](https://github.com/mastro993/zai-app/issues/13)
- [Decide Zai web deployment and data ownership model](https://github.com/mastro993/zai-app/issues/14)
- [Decide the command transport abstraction](https://github.com/mastro993/zai-app/issues/15)
- [Design shared ServiceContext initialization for Tauri and Axum](https://github.com/mastro993/zai-app/issues/16)
- [Design REST endpoints for current Cash flow commands](https://github.com/mastro993/zai-app/issues/17)
- [Decide web file import behavior](https://github.com/mastro993/zai-app/issues/18)
- `AGENTS.md`
- `apps/frontend/AGENTS.md`
- `CONTEXT.md`
- `docs/agents/domain.md`
- `docs/wayfinder/wealthfolio-web-mode-fit.md`
- `docs/wayfinder/service-context-initialization.md`
- `docs/wayfinder/cash-flow-rest-endpoints.md`
- `package.json`
- `apps/frontend/package.json`
- `apps/frontend/vite.config.ts`
- `apps/frontend/src/commands/shared.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-categories.ts`
- `apps/frontend/src/features/cash-flow/commands/transactions.ts`
- `apps/frontend/src/features/cash-flow/commands/category-import.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-import.ts`
- `apps/frontend/src/features/cash-flow/commands/category-export.ts`
- `apps/frontend/src/features/cash-flow/commands/transaction-export.ts`
- `apps/frontend/src/routes/cash-flow.categories.tsx`
- `apps/frontend/src/routes/cash-flow.transactions.tsx`
- `apps/tauri/src/lib.rs`
- `apps/tauri/src/commands/transaction_categories.rs`
- `apps/tauri/src/commands/transactions.rs`
- `crates/db/src/connection.rs`
- `crates/db/src/test_utils.rs`
- `crates/core/src/errors.rs`
- `crates/db/src/errors.rs`
- `.github/workflows/ci.yml`
