# Choices

## 2026-08-17

- **Currency prototype lives on `/settings?variant=`, not a new route.** Five scenes still share one lab, but a dedicated `/prototype/currency-controls` dirty `routeTree.gen.ts` and fails `check:routes` until commit. Existing Settings host keeps the gen file clean.
- **Three variants: Ledger, Inspector, Workspace.** Ledger is table-first and compact. Inspector is a two-pane document. Workspace is a default-currency hero with blocking banners and dual amounts. Structure differs; tokens do not.
- **Scenes via `?scene=`.** Variant and scene are orthogonal so a reviewer can compare the same surface across layouts without remounting fixtures.
- **In-memory fixtures only.** EUR default, USD last-used, GBP stale, JPY adding, CHF disabled, CAD import-only. No backend, no persistence.
- **Accepted UI mix:** Ledger for Currency settings, transaction form, and detail/pending. Inspector for import currency prep and initial setup. Do not ship Workspace.
