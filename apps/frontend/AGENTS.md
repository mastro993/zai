# Frontend app

## Stack

| Layer           | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Framework       | React 19                                                  |
| Routing         | TanStack Router (file-based, `src/routes/`)               |
| App shell       | TanStack Start (default CLI blank starter)                |
| Styling         | Tailwind CSS v4 + existing shadcn tokens                  |
| Toolchain       | Vite 8, `@tanstack/router-cli`, `@tanstack/devtools-vite` |
| Package manager | pnpm                                                      |

The CLI `--tailwind` flag is deprecated; Tailwind is always enabled in TanStack Start scaffolds.

## Frontend scripts

```bash
pnpm --filter frontend dev              # Vite on :1420 (Tauri devUrl)
pnpm --filter frontend generate-routes  # Regenerate src/routeTree.gen.ts
pnpm --filter frontend build
```

## Key files

```json
apps/frontend/
├── src/
│   ├── routes/           # File-based routes (__root.tsx, index.tsx, …)
│   ├── routeTree.gen.ts  # Generated — run generate-routes after route changes
│   ├── router.tsx        # Router factory + type registration
│   └── styles.css        # Tailwind + shadcn design tokens
├── tsr.config.json
├── vite.config.ts
└── .cta.json             # TanStack CLI project metadata
```

## Known gotchas

1. **Route tree**: After adding/removing route files, run `pnpm --filter frontend generate-routes`.
2. **Tauri production build**: TanStack Start emits `dist/client` + `dist/server` (SSR). Tauri `frontendDist` expects static assets at `dist/`. Production Tauri builds need a follow-up (static client export or adapter) — dev via `devUrl` works today.
3. **Intent skills**: TanStack Router/Start skills appear in `intent list` only after their packages are installed in `apps/frontend`.
4. **Devtools**: `@tanstack/devtools-vite` strips devtools from production builds automatically.

## Next steps

- [ ] Resolve Tauri `frontendDist` vs TanStack Start SSR output for release builds
- [ ] Add route layouts as features grow (`src/routes/_authenticated/`, etc.)
- [ ] Wire `commands/` and Tauri IPC behind route loaders

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
