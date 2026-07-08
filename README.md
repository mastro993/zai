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
