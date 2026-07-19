# Frontend app

## Stack

| Layer           | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Framework       | React 19                                                  |
| Routing         | TanStack Router (file-based, `src/routes/`, SPA)          |
| Styling         | Tailwind CSS v4 + existing shadcn tokens                  |
| Toolchain       | Vite 8, `@tanstack/router-cli`, `@tanstack/devtools-vite` |
| Package manager | pnpm                                                      |

## Frontend scripts

```bash
pnpm --filter frontend dev              # Vite on :1420 (Tauri devUrl)
pnpm --filter frontend generate-routes  # Regenerate src/routeTree.gen.ts
pnpm --filter frontend build
```

## Structure

```json
apps/frontend/
├── src/
│   ├── routes/           # File-based routes (__root.tsx, index.tsx, …)
│   ├── components/       # Shared components
│   │   └── ui/           # Shadcn components (do not touch)
│   ├── features/         # Self-contained feature modules
│   ├── commands/         # Shared invokeCommand plumbing
│   ├── lib/              # Primitives and utilities
│   ├── types/            # Shared types
│   ├── routeTree.gen.ts  # Generated — run generate-routes after route changes
│   ├── main.tsx          # SPA entry (RouterProvider)
│   ├── router.tsx        # Router factory + type registration
│   └── styles.css        # Tailwind + shadcn design tokens
├── index.html
├── tsr.config.json
├── vite.config.ts
└── .cta.json             # TanStack CLI project metadata
```

## Feature folders

Feature modules live under `src/features/<feature>/`. Create folders only when
the feature needs them:

```json
src/features/<feature>/
├── screens/     # Route-level components imported by src/routes
├── components/  # Feature-private UI components
├── types/       # Zod schemas plus inferred/domain/UI types
├── lib/         # Pure helpers and feature-local utilities
├── commands/    # Feature-specific backend command wrappers
└── hooks/       # Feature-specific React hooks, when extraction is worthwhile
```

- Route files import feature screens directly.
- Keep imports direct to concrete files; do not add barrel files by default.
- Keep shared command plumbing in `src/commands`; place feature-specific
  command wrappers in the owning feature's `commands/` folder.
- Put tests in the nearest folder-specific `__tests__/` directory.

## Known gotchas

1. **Route tree**: After adding/removing route files, run `pnpm --filter frontend generate-routes`.
2. **Tauri production build**: Vite emits static assets to workspace `dist/`. Tauri `frontendDist` points at `../../dist`.
3. **Intent skills**: TanStack Router skills appear in `intent list` only after their packages are installed in `apps/frontend`.
4. **Devtools**: `@tanstack/devtools-vite` strips devtools from production builds automatically.

## Skill loading

Before editing files for a substantial routing or frontend-framework task:

- Consult the reviewed local skill first:
  `.agents/skills/tanstack-router/SKILL.md` (also linked from
  `.claude/skills/tanstack-router`).
- Prefer other checked-in skills under `.agents/skills/` when they match the
  task. See `docs/agents/skill-provenance.md` for layout and trust rules.
- Do not run unpinned remote skill loaders (for example
  `pnpm dlx @tanstack/intent@latest`). If remote package execution is genuinely
  required, use an explicitly reviewed pinned version and obtain operator
  approval before running it.
