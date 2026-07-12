# Budget Period Advancement and Rollover History Design

**Issue:** #69 — Advance budget periods and expose rollover history

## Goal

Advance elapsed budget periods lazily and deterministically, calculate signed
rollover results, and expose newest-first period history with bounded paging.

## Design

Budget reads take one local-calendar clock sample at their operation boundary.
The repository compares that sample with the newest materialized period. If the
projection already contains the sample's period, list, detail, and history
reads use read connections and indexed projected rows. If periods are missing,
the repository materializes the missing chain in one serialized writer
transaction before returning the projected result.

Each elapsed period is materialized in chronological order, including periods
with no matching transactions. The first period has no carry. Previous-period-
only rollover carries the immediately preceding period's base allowance minus
its net budget spending, excluding carry received by that period. Cumulative
rollover carries the preceding period's remaining allowance. Off carries zero.
All arithmetic is checked, signed, and unclamped; effective allowance may be
negative. The existing half-open local-calendar boundaries and Monday week
start remain authoritative.

The core budget model gains the two rollover modes and a pure period calculation
that receives the previous period's carry input. The repository keeps current
configuration rows immutable for closed periods and creates the next period's
configuration from the preceding effective configuration. Current transaction
matching happens only while materializing a stale chain; projected reads load
period results through the existing `(budget_id, period_start DESC)` index.

History returns a paginated data envelope using page 1 and 50 rows by default,
accepting page sizes from 1 through 100. Results sort by period start descending,
with the open/current period first. Invalid paging input returns a structured
validation error before database work.

## Interfaces

- `BudgetRolloverMode`: `off`, `previousPeriodOnly`, `cumulative`.
- `BudgetPeriod` exposes base allowance, effective allowance, signed net budget
  spending, remaining allowance, status, and half-open boundaries.
- `BudgetPeriodHistory` uses `PaginatedData<BudgetPeriod>` semantics.
- Budget repository and service expose paginated history and accept one sampled
  local `NaiveDateTime` per read operation internally.
- Axum and Tauri expose history through the budget feature's existing command
  and route conventions; frontend types and command wrappers mirror the
  serialized contract.

## Error handling and pillars

Checked overflow, invalid persisted enum values, invalid period order, and
invalid page parameters produce existing domain/storage errors. Writer
materialization is atomic, so a failed chain cannot leave partial projections.
No timers, remote services, telemetry, or secret storage are introduced.
Indexed reads reduce repeated transaction scans and avoid writer contention for
already-current data. SQLite remains the sole source of local persisted state.

## Testing

- Core tests cover all rollover modes, signed unused allowance and overspending,
  empty periods, first-period behavior, negative effective allowance, and
  chronological carry propagation.
- Repository tests cover lazy advancement, one clock sample per operation,
  period-end boundaries, recovery of missing projections, indexed/read-only
  current reads, newest-first history, page sizes 1–100, defaults, and
  overlapping budgets.
- Transport tests cover history query validation and serialized page shape.
- Run focused Rust tests during each red-green slice, then formatting, clippy,
  workspace tests, frontend checks, and branch review.
