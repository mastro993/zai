# Zai

Personal finance desktop app built as a Tauri monorepo.

## Structure

- `apps/frontend` - React UI
- `apps/tauri` - Tauri shell and commands
- `crates/core` - Rust business logic

## Commands

- `pnpm dev` - start the frontend
- `pnpm dev:tauri` - start the desktop app
- `pnpm build` - build the frontend
- `pnpm check` - run TypeScript, lint, format, Vitest, route-tree freshness, and Rust check/test/fmt

## Contributing

Optional local pre-commit hooks are configured with [Lefthook](https://github.com/evilmartians/lefthook). After `pnpm install`, hooks run automatically on commit for staged frontend TypeScript files (format check, oxlint, and route-tree freshness when route files change).

CI still uses `pnpm check` as the canonical verification command. Skip hooks when needed:

```bash
LEFTHOOK=0 git commit -m "your message"
```
