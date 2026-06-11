# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context personal finance desktop app built with Tauri:

- Frontend: React and TypeScript in `src/`
- Business logic/source of truth: Rust in `src-core/`
- Tauri shell, plugins, and commands: Rust in `src-tauri/`

Use one root `CONTEXT.md` for shared product and domain language. Use `docs/adr/` for architectural decisions across the app.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** - read ADRs that touch the area you're about to work in

If any of these files don't exist, proceed silently. Don't flag their absence or suggest creating them upfront. The producer skill creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either reconsider whether you're inventing language the project doesn't use, or note the gap for future domain-doc work.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
