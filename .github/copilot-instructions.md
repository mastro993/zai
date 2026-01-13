# Zai - Personal Finance Desktop App

## Project Overview

Zai is a personal finance desktop application built with Tauri, React, and Rust. It helps users track expenses, manage budgets, and visualize financial data through an intuitive interface.
Its main focus is privacy and reliability: users retain full control over their data, stored locally.

## Architecture Overview

Zai is a Tauri 2 desktop app: React/TypeScript frontend + Rust backend with SQLite (Diesel ORM).

```
src/              → React frontend (Vite, TanStack Router/Query)
src-core/         → Rust business logic library (features, database, Diesel)
src-tauri/        → Tauri app shell (commands, context initialization)
```

### Data Flow

1. **Frontend** → `invokeTauri()` calls Tauri commands
2. **src-tauri/commands/** → Thin wrappers accessing `ServiceContext`
3. **src-core/features/{domain}/service** → Business logic
4. **src-core/features/{domain}/repository** → Database via `WriteHandle` actor

All database writes go through a single-writer actor (`write_actor.rs`) to avoid SQLite concurrency issues.

## Developer Commands

```bash
pnpm dev              # Start Vite dev server (port 1420)
pnpm tauri dev        # Run full Tauri app with hot reload
pnpm tauri build      # Production build
pnpm lint             # ESLint with zero warnings
cargo check           # Check Rust code
cargo test            # Run Rust tests (use tokio::test for async)
```

## Naming Conventions

| Layer            | Convention   | Example                                         |
| ---------------- | ------------ | ----------------------------------------------- |
| Frontend folders | `kebab-case` | `src/features/transaction-category/`            |
| Rust modules     | `snake_case` | `src-core/src/features/transaction_categories/` |
| React components | `PascalCase` | `TransactionCategoryList.tsx`                   |
| Rust files       | `snake_case` | `transaction_categories_service.rs`             |

## Common Gotchas

1. **WriteHandle for all mutations** - Never use `pool.get()` directly for writes; always use `WriteHandle.exec()` to avoid SQLite locking issues

2. **Register commands in TWO places**:

   - `src-tauri/src/main.rs` → `invoke_handler` macro
   - `src-tauri/src/context/providers.rs` → wire up service dependencies

3. **Serde casing mismatch** - Rust structs need `#[serde(rename_all = "camelCase")]` to match TypeScript Zod schemas

## Technology-Specific Instructions

Additional instructions are auto-applied based on file type:

- **React/TypeScript** (`.ts`, `.tsx`, `.js`, `.jsx`): See [frontend.instructions.md](.github/frontend.instructions.md)
- **Rust/Tauri** (`.rs`): See [backend.instructions.md](.github/backend.instructions.md)
