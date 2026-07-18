# Wealthfolio Web Mode Fit for Zai

Research note for [Research Wealthfolio's web mode fit for Zai](https://github.com/mastro993/zai-app/issues/13).

## Question

Which parts of Wealthfolio's web mode should Zai copy, simplify, or avoid for a much smaller Cash flow app, across Axum server structure, shared service wiring, frontend adapter selection, dev scripts, security defaults, and parity testing?

## Decision

Zai should copy Wealthfolio's architectural shape, not its size:

- Use build-target adapter selection so Cash flow feature code calls one stable command contract and never checks whether it is running under Tauri IPC or web REST.
- Add a small Axum server that delegates to the same service context as Tauri, with handlers as thin as existing Tauri commands.
- Keep the first web mode loopback/local-first by default, with fail-closed rules for any non-loopback bind before authentication exists.
- Add parity tests early: every frontend command must be registered by both the Tauri IPC side and the web REST side, and the first server routes need request/response tests.

Zai should not copy Wealthfolio's broad adapter tree, auth/OIDC stack, OpenAPI surface, schedulers, domain events, MCP, device sync, cloud sync, or static/Docker packaging in the first planning slice. Those are useful reference points only after Zai has a real need.

## Copy

### Build-time adapter selection

Wealthfolio selects desktop versus web at build time with a Vite alias keyed by `BUILD_TARGET`, so imports of the adapter module resolve to either Tauri or web implementation. Zai should copy that idea because it keeps feature code clean and enables dead-code elimination for Tauri-only imports.

For Zai, keep it smaller than Wealthfolio:

- Keep feature-level command wrappers in `apps/frontend/src/features/<feature>/commands/`.
- Change the shared command plumbing behind `invokeCommand` rather than introducing a large `src/adapters` surface immediately.
- Introduce a build target such as `BUILD_TARGET=tauri|web`.
- Alias only the command transport module at first, for example a Tauri implementation and a web implementation that both export `invokeCommand<T>(command, args): CommandResult<T>`.
- Preserve `CommandResult<T>` from `@praha/byethrow`; the web implementation should wrap `fetch` failures and non-2xx responses into `CommandError`, not throw through the feature command API.

### Thin Axum handlers

Wealthfolio's account handlers are thin Axum functions: extract state and JSON/query/path data, call a core service, and return JSON or status. Zai should copy this handler style for Cash flow categories and transactions.

For Zai, the first server route modules should mirror the current Tauri command modules:

- `transaction_categories` routes call `TransactionCategoriesServiceTrait`.
- `transactions` routes call `TransactionsServiceTrait`.
- DTOs should use the same camelCase shapes the Tauri command boundary already accepts from the frontend.
- Core/database logic stays in `crates/core` and `crates/db`; handlers must not reimplement business rules.

### Shared service construction

Wealthfolio has one server state builder that creates repositories and services from SQLite, then both handlers and background services use that state. Zai already has the smaller equivalent under `apps/tauri/src/context`: `initialize_context` builds repositories and services, and `ServiceContext` exposes trait-backed services.

Zai should copy the "one service graph" principle, but the exact crate/module home should be decided by [Design shared ServiceContext initialization for Tauri and Axum](https://github.com/mastro993/zai-app/issues/16). The important constraint from this research is that both `apps/tauri` and `apps/server` should call the same initialization path instead of duplicating repository/service wiring.

### Security defaults

Wealthfolio's server config refuses to start on a non-loopback address without authentication unless explicitly opted out. Zai should copy this fail-closed posture.

For the first Zai web mode:

- Default bind should be loopback, such as `127.0.0.1`.
- No-auth local mode is acceptable only on loopback.
- Any non-loopback bind should require a later authentication decision or an explicit unsafe override.
- CORS should be narrow in dev and not default to credentialed wildcard behavior.
- Loopback mutations must reject hostile browser `Origin` values and bodyless simple POSTs. Web mode sends `application/json` (often `{}`) so HTML forms cannot mutate alert state without login.

The full authentication model belongs to [Decide Zai web deployment and data ownership model](https://github.com/mastro993/zai-app/issues/14), but this research resolves that the default posture should be copied from Wealthfolio: local convenience is fine; accidental network exposure is not.

### Dev script shape

Wealthfolio's `scripts/dev-web.mjs` runs the server and Vite together, sets `BUILD_TARGET=web`, loads `.env.web`, enables a Vite API proxy, and shuts both processes down together.

Zai should copy the shape, but simplify the script:

- Add a root `dev:web` script when the server exists.
- Set `BUILD_TARGET=web`.
- Start `cargo run --manifest-path apps/server/Cargo.toml`.
- Start `pnpm --filter frontend dev`.
- Use a Vite proxy or a single `VITE_API_TARGET`; do not add file logging or production static serving yet.

## Simplify

### REST command mapping

Wealthfolio's web adapter has a large command registry and a large switch for command-specific URL/body shaping. Zai should start with a tiny typed mapping for the current Cash flow command surface only.

Likely first mappings, to be finalized by [Design REST endpoints for current Cash flow commands](https://github.com/mastro993/zai-app/issues/17):

- Categories: list, get, create, update, delete many, import.
- Transactions: list with page/filter/sort, get, create, update, delete one, delete many, import, import batch.

Use normal REST where it is obvious, but preserve frontend `CommandResult<T>` semantics. The web transport may map command names to routes internally; feature command wrappers should not know route URLs.

### Error contract

Wealthfolio serializes API errors as JSON with a `message`. Zai should copy that minimal shape but keep the status mapping small:

- Validation or malformed payload: `400`.
- Missing row: `404`.
- Invariant or conflict, such as category constraints: `409` where the core error can identify it.
- Unexpected internal failure: `500`.

The frontend web transport should read `message` and return `Result.fail(new CommandError(message))`.

### Server dependencies

Wealthfolio's server depends on Axum, tower layers, OpenAPI, auth, encryption, and many app crates. Zai should begin with only the dependencies needed for the first local server:

- `axum`
- `tokio`
- `tower-http` features for CORS, trace, timeout, and possibly request IDs
- `serde` and `serde_json`
- `thiserror`
- `zai-core`
- `zai-db`

OpenAPI and generated clients stay in fog until the first REST contract is known.

### Tests

Wealthfolio's parity test is the best pattern to copy early, but Zai can make it smaller:

- Scan frontend command wrappers for `invokeCommand("...")`.
- Scan `apps/tauri/src/lib.rs` for registered Tauri commands.
- Scan the web command map for registered REST commands.
- Fail if any command is missing from either runtime.

Also add Rust route tests for the first server routes using temporary SQLite data and Axum `oneshot`, following Wealthfolio's health/static/auth test style but without auth/static scope unless those decisions have been made.

## Avoid for now

Do not copy these Wealthfolio parts into the first Zai plan:

- A full `src/adapters` product platform with many typed runtime exports.
- A giant command switch before Zai has enough commands to justify it.
- Auth, OIDC, session cookies, password hashing, encrypted secret files, PATs, MCP, or agent access.
- Device sync, cloud sync, broker sync, domain event buses, schedulers, SSE/event streams, or background workers.
- Static asset serving, Docker packaging, or production deployment defaults.
- Multipart upload behavior for CSV import. Zai already has a separate file behavior ticket, [Decide web file import behavior](https://github.com/mastro993/zai-app/issues/18).
- OpenAPI generation or generated clients before route semantics stabilize.

## Effects on the Map

This ticket does not need new child tickets. The decisions it exposes are already covered by the current frontier:

- [Decide Zai web deployment and data ownership model](https://github.com/mastro993/zai-app/issues/14) owns auth and non-loopback policy.
- [Decide the command transport abstraction](https://github.com/mastro993/zai-app/issues/15) owns the build-time adapter boundary.
- [Design shared ServiceContext initialization for Tauri and Axum](https://github.com/mastro993/zai-app/issues/16) owns service wiring location.
- [Design REST endpoints for current Cash flow commands](https://github.com/mastro993/zai-app/issues/17) owns route shape.
- [Decide web file import behavior](https://github.com/mastro993/zai-app/issues/18) owns CSV import/export behavior.
- [Define the web mode verification matrix](https://github.com/mastro993/zai-app/issues/19) owns parity and server route checks.

The map fog should remain unchanged: packaging, OpenAPI/generated clients, event streams/background jobs, and future desktop-only fallbacks still depend on later decisions.

## Sources

Wealthfolio at commit `659d776980718e70ec4d669a086ddebefa82530f`:

- [Adapter architecture doc](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/docs/architecture/adapters.md)
- [Frontend Vite config](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/vite.config.ts)
- [Adapter parity test](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/src/adapters/adapter-command-parity.test.ts)
- [Web adapter core](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/src/adapters/web/core.ts)
- [Tauri adapter core](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/src/adapters/tauri/core.ts)
- [Server main](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/main.rs)
- [Server config](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/config.rs)
- [Server router](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/api.rs)
- [Server state builder](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/main_lib.rs)
- [Account handlers](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/api/accounts.rs)
- [Server API errors](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/src/error.rs)
- [Server README](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/README.md)
- [Web dev script](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/scripts/dev-web.mjs)
- [Health route test](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/tests/health.rs)
- [Static route test](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/tests/static_routes.rs)
- [Auth test](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/server/tests/auth.rs)
- [Web file adapter](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/src/adapters/web/files.ts)
- [Tauri file adapter](https://github.com/wealthfolio/wealthfolio/blob/659d776980718e70ec4d669a086ddebefa82530f/apps/frontend/src/adapters/tauri/files.ts)

Zai local sources:

- `apps/frontend/src/commands/shared.ts`
- `apps/frontend/src/features/categories/commands/transaction-categories.ts`
- `apps/frontend/src/features/transactions/commands/transactions.ts`
- `apps/frontend/src/features/categories/commands/category-import.ts`
- `apps/frontend/src/features/transactions/commands/transaction-import.ts`
- `apps/frontend/src/features/categories/commands/category-export.ts`
- `apps/frontend/src/features/transactions/commands/transaction-export.ts`
- `apps/frontend/vite.config.ts`
- `apps/tauri/src/context/providers.rs`
- `apps/tauri/src/context/registry.rs`
- `apps/tauri/src/commands/transaction_categories.rs`
- `apps/tauri/src/commands/transactions.rs`
- `apps/tauri/src/lib.rs`
- `Cargo.toml`
- `package.json`
