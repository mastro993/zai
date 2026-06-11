# Zai

Personal finance desktop app built with Tauri (Rust backend + React frontend).

## Package Manager

`pnpm`

## Project structure

- `/src`: all the frontend code, Vite + React
- `/src-core`: business logic in pure Rust, source of truth
- `/src-tauri`: Tauri related code, plugins, commands

## Guidelines

- [Frontend conventions](docs/frontend.md) — React, TypeScript, styling
- [Backend conventions](docs/backend.md) — Rust, Diesel, async patterns
- Always run pnpm lint and pnpm tsc:check before considering any task completed
- Always check HeroUI components before creating a new one from scratch
- Always use Hugeicons for icons

## Key Constraint

Do only what's requested—avoid adding unrequested features or refactoring.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `mastro993/zai-app`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context Tauri app with layered frontend, Rust core, and Tauri shell code. See `docs/agents/domain.md`.


