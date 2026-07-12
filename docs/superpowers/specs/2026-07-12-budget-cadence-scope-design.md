# Budget Cadence, Scope, and Measurement Design

## Goal

Extend existing budgets so every supported cadence, category scope, and measurement mode produces deterministic signed spending for the current half-open local-calendar period.

## Design

- Core budget models expose day, Monday-based week, month, and year cadences. A shared period helper returns timezone-less `NaiveDateTime` boundaries with inclusive start and exclusive end.
- Budget creation accepts optional cadence, category IDs, and measurement mode. Existing payloads remain compatible: month, empty scope, and Spending mode remain defaults.
- Category selections are canonicalized deterministically. Duplicate IDs are removed; a selected ancestor subsumes selected descendants; matching expands selected roots to active descendants. Empty scope means all categorized and uncategorized transactions.
- Repository matching filters active transactions by half-open timestamp and expanded category scope. Spending adds every matching expense, subtracts income in Spending categories, and ignores Income-category or uncategorized income. Net cash flow subtracts every matching income, including uncategorized income in an empty scope.
- Arithmetic remains checked and signed. Zero matches are valid; results are never clamped.
- SQLite receives a forward migration expanding the cadence constraint while preserving existing budget rows.
- Tauri, Axum, and frontend budget contracts carry the new fields without changing default behavior.

## Verification

- Core unit tests cover all cadence boundaries, Monday week starts, leap/year transitions, scope canonicalization, signed arithmetic, zero matches, and overflow.
- Repository integration tests cover root/child and explicit scopes, empty scopes, both measurement modes, overlapping budgets, all cadences, and half-open boundaries.
- Existing frontend and server tests remain green; contract tests cover new defaults and serialized fields.

## Pillars

All calculations remain local and deterministic. Indexed date/category filtering limits database work. Checked arithmetic and atomic writer transactions preserve reliability. No remote services or telemetry are added.
