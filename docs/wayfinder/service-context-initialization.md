# ServiceContext Initialization for Tauri and Axum

Research note for [Design shared ServiceContext initialization for Tauri and Axum](https://github.com/mastro993/zai-app/issues/16).

## Question

How should Zai share database and service initialization between `apps/tauri` and the new `apps/server` so both runtimes use the same `crates/core` and `crates/db` services without duplicating wiring or coupling Axum to Tauri?

## Decision

Create a small runtime-neutral composition crate for the shared service graph, then let each runtime own only its shell concerns.

Use a new workspace crate, preferably `crates/app` with package name `zai-app`, to own:

- `ServiceContext`, the trait-backed service registry currently in `apps/tauri/src/context/registry.rs`.
- `initialize_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<ServiceContext>`, the concrete graph builder currently in `apps/tauri/src/context/providers.rs`.
- Any tiny app-level construction types needed later, such as a `ServiceContextConfig`, only when the first server actually needs more than an app data directory.

Both runtime crates should depend on this shared crate:

- `apps/tauri` resolves the Tauri app data directory, calls `zai_app::initialize_context(...)`, wraps the result in `Arc<ServiceContext>`, and registers it with `handle.manage(...)`.
- `apps/server` resolves its configured local data directory, calls the same initializer during Tokio startup, wraps it in `Arc<ServiceContext>`, and installs it as Axum state.

Do not put this initializer in `crates/core`: it would force core to know about `zai-db`, which would break the current dependency direction where core owns business logic and repository traits while db implements those traits.

Do not put it in `crates/db`: db should remain the storage adapter. Having storage construct the application service graph would make the lower layer know too much about app composition.

Do not leave the type under `apps/tauri`: that would make Axum depend on a Tauri crate or duplicate the wiring, both of which violate the destination.

## Shape

The shared crate should expose a minimal API:

```rust
pub struct ServiceContext {
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
    pub transactions_service: Arc<dyn TransactionsServiceTrait>,
}

impl ServiceContext {
    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> { ... }
    pub fn transactions_service(&self) -> Arc<dyn TransactionsServiceTrait> { ... }
}

pub fn initialize_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<ServiceContext> {
    let database = zai_db::connect(app_data_dir)?;
    let transaction_categories_repository = database.transaction_categories_repository();
    let transactions_repository = database.transactions_repository();

    Ok(ServiceContext {
        transaction_categories_service: Arc::new(TransactionCategoriesService::new(
            transaction_categories_repository,
        )),
        transactions_service: Arc::new(TransactionsService::new(transactions_repository)),
    })
}
```

Keep `Arc<ServiceContext>` creation outside the shared initializer. Tauri and Axum both want cloneable shared state, but the shared crate does not need to prescribe the outer owner.

Keep command and handler error mapping outside the shared initializer. Tauri commands can keep returning `Result<T, String>` for now, while Axum handlers can map `zai_core::Error` into HTTP status plus `{ message }`. The common boundary is the service graph, not the transport error shape.

## Runtime Constraints

`zai_db::connect` is not a plain synchronous constructor in practice: it builds the pool, runs migrations, and calls the write actor setup, which requires a current Tokio runtime through `tokio::runtime::Handle::try_current()`.

That means both runtimes must call the shared initializer from inside their runtime startup:

- Tauri can keep using `tauri::async_runtime::block_on(...)` during setup.
- Axum should call it from the `#[tokio::main]` startup path before building the router.

Avoid global lazy initialization, static singletons, or frontend-triggered initialization. The server owns SQLite in web mode, and startup should fail early if the database cannot initialize.

## Implementation Notes

Update the workspace members and dependencies:

- Add `crates/app` to `Cargo.toml` workspace members.
- Add `zai-app = { path = "crates/app" }` to workspace dependencies.
- Depend on `zai-app` from `apps/tauri` and the future `apps/server`.
- Keep `zai-core`, `zai-db`, and `log` as dependencies of `zai-app`.

Move, do not fork, the Tauri context code:

- Move `apps/tauri/src/context/registry.rs` into the shared crate.
- Move `apps/tauri/src/context/providers.rs` into the shared crate and change its error type from `Box<dyn std::error::Error>` to `zai_core::Result`.
- Delete or shrink `apps/tauri/src/context` after Tauri imports `zai_app::ServiceContext`.

Keep runtime-specific path and plugin setup where it is:

- Tauri keeps `handle.path().app_data_dir()`, `handle.manage(...)`, Stronghold, dialog, fs, log, and single-instance setup.
- Axum owns bind address validation, CORS, router construction, graceful shutdown, and any server config parsing.

## Effects on Later Tickets

[Design REST endpoints for current Cash flow commands](https://github.com/mastro993/zai-app/issues/17) can assume Axum handlers receive `Arc<ServiceContext>` and call the same service traits as Tauri commands.

[Define the web mode verification matrix](https://github.com/mastro993/zai-app/issues/19) should include a compile-level or unit check that both runtime crates depend on the same shared `ServiceContext` type, plus route tests built from the shared initializer against a temporary database.

No new Wayfinder tickets are needed from this decision. The existing REST endpoint, file import, and verification tickets still cover the exposed follow-up decisions.

## Sources

- `apps/tauri/src/context/providers.rs`
- `apps/tauri/src/context/registry.rs`
- `apps/tauri/src/lib.rs`
- `crates/db/src/connection.rs`
- `crates/db/src/write_actor.rs`
- `crates/core/src/features/transaction_categories/traits.rs`
- `crates/core/src/features/transactions/traits.rs`
- [Research Wealthfolio's web mode fit for Zai](https://github.com/mastro993/zai-app/issues/13)
- [Decide Zai web deployment and data ownership model](https://github.com/mastro993/zai-app/issues/14)
- [Decide the command transport abstraction](https://github.com/mastro993/zai-app/issues/15)
