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
- `pnpm check` - run the complete frontend and backend validation gates
- `pnpm frontend:check` - run frontend format, lint, route, type, and unit-test checks
- `pnpm backend:check` - run Rust format, Clippy, and test checks
- `pnpm test` - run frontend, backend, and hook tests
- `pnpm test:e2e:web` - run the web-mode Playwright smoke test

## Contributing

Optional local pre-commit hooks are configured with [Lefthook](https://github.com/evilmartians/lefthook). After `pnpm install`, hooks run automatically on commit for staged frontend TypeScript files (format check, oxlint, and route-tree freshness when route files change).

PostToolUse hooks automatically format and lint changed frontend or Rust files, then verify the result. Remaining issues are reported without blocking the edit.

CI runs the frontend and backend gates in separate parallel jobs. Skip pre-commit hooks when needed:

```bash
LEFTHOOK=0 git commit -m "your message"
```
