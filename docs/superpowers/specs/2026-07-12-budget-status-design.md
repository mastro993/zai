# Budget Status Presentation Design

**Issue:** #68 — Surface warning and overspent budget status

## Goal

Let users configure a budget warning threshold or disable it, then scan the
ledger and detail page with enough period context to interpret signed,
minor-unit amounts and the current status.

## Current context

The core budget model already validates warning percentages from 1 through 100,
defaults new budgets to 80%, rounds warning thresholds upward, suppresses
warnings for a zero allowance, and gives overspent precedence. The repository
stores and returns the current period's effective allowance, signed net budget
spending, remaining allowance, and status. The remaining gap is the create form
always sending 80%, while the ledger only shows the period start date and does
not show cadence.

## Design

### Warning configuration

Extend the existing `budgetFormSchema` with a warning percentage input that
accepts an integer string from 1 through 100 or a `disabled` sentinel. Transform
the submitted value to `number | null`, preserving the backend's existing
contract. Keep `80` as the default. Render a numeric input plus a checkbox in
the existing dialog; disabling the checkbox disables the numeric input and
sends `null`. Validation remains local and uses the existing field-error
pattern.

Update `createBudget` to forward `values.warningPercentage`. Web and Tauri
already pass the `NewBudget` payload through the shared command path, so no
transport or database change is needed.

### Period presentation

Add shared formatting helpers for a budget's current period and cadence. The
ledger period cell will show cadence and the complete half-open date range.
The detail page will use the same range helper and label it as the current
period. Existing scope, metric, and status fields remain unchanged.

Use the existing `formatCurrencyFromMinor` helper for every metric. Add a
negative-value regression test to prove signed minor units remain visible.

### Error handling and pillars

No new remote state or telemetry is introduced. Invalid warning input is
rejected before IPC; backend validation remains authoritative for direct API
callers. Existing `Result` and command-error flows remain intact. The design
keeps calculation logic in the core and presentation logic in the frontend,
preserving local-first privacy, deterministic status calculation, and a small
change surface.

## Testing

- Add schema tests for the default 80%, custom whole percentages, disabled
  warnings, and invalid values.
- Extend the form test to verify the submitted warning value and disabled
  value.
- Add formatting tests for cadence/current-period text and negative currency.
- Run focused Vitest files after each red-green cycle, then frontend checks and
  the full Rust workspace suite. The known sandbox loopback-bind test may need
  an approved unsandboxed run.
