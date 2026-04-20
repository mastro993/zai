# Zai

Personal finance desktop app built with Tauri (Rust backend + React frontend).

## Package Manager

pnpm

## Project structure
- /src: all the frontend code, Vite + React
- /src-core: business logic in pure Rust, source of truth
- /src-tauri: Tauri related code, plugins, commands

## Guidelines

- Always run pnpm lint and pnpm tsc:check before considering any task completed
- Always check HeroUI components before creating a new one from scratch
- Always use Hugeicons for icons