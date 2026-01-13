---
description: "Rust and Tauri development standards and best practices"
applyTo: "**/*.rs"
---

## Feature Structure (Rust)

Follow `transaction_categories` pattern:

1. **Models** in `src-core/src/features/{name}/{name}_models.rs`
2. **Traits** in `{name}_traits.rs` - define `ServiceTrait` + `RepositoryTrait`
3. **Repository** in `{name}_repository.rs` - use `WriteHandle` for mutations
4. **Service** in `{name}_service.rs` - implement business logic
5. **Commands** in `src-tauri/src/commands/{name}.rs` - use `#[tauri::command]`
6. **Register** in `src-tauri/src/main.rs` invoke_handler and `context/providers.rs`

## Code Conventions

- Use `snake_case` for functions/variables, `PascalCase` for types
- Custom errors via `thiserror` in `src-core/src/errors.rs`
- All async mutations go through `WriteHandle.exec()` actor pattern
- Traits define service/repository interfaces for testability

## Tauri Command Pattern

See [transaction_categories.rs](src-tauri/src/commands/transaction_categories.rs):

```rust
#[tauri::command]
pub async fn get_thing(id: &str, state: State<'_, Arc<ServiceContext>>) -> Result<Thing, String> {
    state.thing_service().get(id).map_err(|e| e.to_string())
}
```

## Database Migrations

Migrations use Diesel CLI and are embedded at compile time.

```bash
# Install Diesel CLI (one-time)
cargo install diesel_cli --no-default-features --features sqlite

# Create a new migration
cd src-core
diesel migration generate {migration_name}

# Run migrations (auto-runs on app start, but manual for dev)
diesel migration run

# Revert last migration
diesel migration revert

# Regenerate schema.rs after migration changes
diesel print-schema > src/schema.rs
```

**Migration naming**: Use format `YYYY-MM-DD-HHMMSS-NNNN_{description}` (e.g., `2025-09-26-065400-0000_init`).

**Important**: After adding/modifying migrations, the schema is auto-regenerated. Ensure `src-core/src/schema.rs` is committed.

## Error Handling

Errors flow: **Repository** → **Service** → **Tauri Command** → **Frontend**

```
src-core/src/errors.rs          # Root Error enum
src-core/src/database/errors.rs # DatabaseError variants
```

**Rust error hierarchy:**

```rust
Error::Database(DatabaseError)  // DB connection, query failures
Error::Repository(String)       // Data access issues
Error::NotFound(String)         // Entity not found
Error::InvalidData(String)      // Validation failures
```

**Tauri commands convert to String** for frontend:

```rust
.map_err(|e| format!("Failed to load: {}", e))
```

## Testing (Rust)

```rust
// Use tokio::test for async tests
#[tokio::test]
async fn test_create_category() {
    let pool = create_test_pool();  // See src-core/src/database/test_utils.rs
    let writer = spawn_writer(pool.clone());
    let repo = TransactionCategoriesRepository::new(pool, writer);

    let result = repo.create_category(new_category).await;
    assert!(result.is_ok());
}

// Mock traits for unit testing services
impl TransactionCategoriesRepositoryTrait for MockRepo { ... }
```

### Tauri Integration Tests

```rust
// In src-tauri, test commands with mock state
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_categories_command() {
        let context = create_test_context().await;
        let state = State::new(Arc::new(context));

        let result = get_transaction_categories(None, state).await;
        assert!(result.is_ok());
    }
}
```

## Tauri Plugins

| Plugin                    | Purpose              | Usage                                        |
| ------------------------- | -------------------- | -------------------------------------------- |
| `tauri-plugin-fs`         | File system access   | Import/export CSV, read user files           |
| `tauri-plugin-dialog`     | Native dialogs       | File picker, save dialogs, alerts            |
| `tauri-plugin-stronghold` | Secure storage       | Encrypted secrets, API keys                  |
| `tauri-plugin-store`      | Persistent key-value | App preferences, settings                    |
| `tauri-plugin-sql`        | SQLite plugin        | Alternative DB access (main app uses Diesel) |
| `tauri-plugin-log`        | Logging              | Use `log::info!`, `log::error!` in Rust      |
| `tauri-plugin-shell`      | Shell commands       | Open URLs, run external processes            |

## Serde Field Renaming

Rust uses `snake_case`, TypeScript expects `camelCase`:

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategory {
    pub parent_id: Option<String>,  // → parentId in JSON
}
```

## Common Gotchas (Rust/Tauri)

1. **WriteHandle for all mutations** - Never use `pool.get()` directly for writes; always use `WriteHandle.exec()` to avoid SQLite locking issues

2. **Register commands in TWO places**:

   - `src-tauri/src/main.rs` → `invoke_handler` macro
   - `src-tauri/src/context/providers.rs` → wire up service dependencies

3. **Serde casing mismatch** - Rust structs need `#[serde(rename_all = "camelCase")]` to match TypeScript Zod schemas

4. **Async trait bounds** - Repository/Service traits require `#[async_trait]` and `Send + Sync` bounds

5. **Migration ordering** - Diesel migrations run in alphabetical order by folder name; use timestamp prefixes
