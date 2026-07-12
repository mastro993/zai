# Budget Status Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure warning percentages or disable warnings, and make budget ledger/detail period context and signed amounts unambiguous.

**Architecture:** Keep warning validation and status calculation in crates/core. Extend the existing frontend form schema and command payload for number-or-null warning percentages. Add shared frontend period-formatting helpers consumed by both budget screens; no new endpoint, migration, or remote service.

**Tech Stack:** React 19, React Hook Form, Zod 4, Vitest, Tailwind v4, Rust core tests.

## Global Constraints

- Preserve local-first behavior: no cloud services, telemetry, remote storage, or external processing.
- Preserve @praha/byethrow command error handling; do not introduce throw, try, or catch in TypeScript.
- Keep shadcn UI components unchanged.
- Keep warning percentages whole integers from 1 through 100; null disables warning; default is 80.
- Keep signed minor-unit values; never clamp or stringify away negative values.
- Keep modified files under 400 LOC and avoid unrelated refactors.

## File map

- Modify: apps/frontend/src/features/cash-flow/types/budget.ts — warning input schema and form output contract.
- Modify: apps/frontend/src/features/cash-flow/types/__tests__/budget.test.ts — schema regression tests.
- Modify: apps/frontend/src/features/cash-flow/commands/budgets.ts — forward warning value.
- Modify: apps/frontend/src/features/cash-flow/components/budget-form-dialog.tsx — warning input and disable control.
- Modify: apps/frontend/src/features/cash-flow/components/__tests__/budget-form-dialog.test.tsx — submitted warning tests.
- Modify: apps/frontend/src/features/cash-flow/lib/budget.ts — shared period/cadence formatting.
- Create: apps/frontend/src/features/cash-flow/lib/__tests__/budget.test.ts — formatting tests.
- Modify: apps/frontend/src/features/cash-flow/screens/budget-screen.tsx — show cadence and full current period.
- Modify: apps/frontend/src/features/cash-flow/screens/budget-detail-screen.tsx — reuse current-period formatter.
- Modify: apps/frontend/src/lib/__tests__/currency.test.ts — signed minor-unit regression test.

### Task 1: Add warning percentage schema contract

**Files:**
- Modify: apps/frontend/src/features/cash-flow/types/__tests__/budget.test.ts
- Modify: apps/frontend/src/features/cash-flow/types/budget.ts

**Interfaces:**
- Produces BudgetFormValues.warningPercentage: number | null.
- Form input accepts "disabled" or an integer string; parsed output accepts 1–100 or null.

- [ ] **Step 1: Write failing schema tests**

Add expectations to the existing schema tests:

~~~ts
expect(result.data.warningPercentage).toBe(80);

expect(
  budgetFormSchema.safeParse({
    name: "Custom warning",
    baseAllowance: "100",
    warningPercentage: "65",
  }),
).toMatchObject({
  success: true,
  data: expect.objectContaining({ warningPercentage: 65 }),
});

expect(
  budgetFormSchema.safeParse({
    name: "Disabled warning",
    baseAllowance: "100",
    warningPercentage: "disabled",
  }),
).toMatchObject({
  success: true,
  data: expect.objectContaining({ warningPercentage: null }),
});

expect(
  budgetFormSchema.safeParse({
    name: "Invalid warning",
    baseAllowance: "100",
    warningPercentage: "101",
  }).success,
).toBe(false);
~~~

- [ ] **Step 2: Run focused test and verify failure**

Run: pnpm --filter frontend test -- src/features/cash-flow/types/__tests__/budget.test.ts

Expected: failure because schema output has no warningPercentage and does not parse the new input.

- [ ] **Step 3: Implement minimal schema change**

In budget.ts, define a transformed warning input schema and add it to budgetFormSchema:

~~~ts
const warningPercentageSchema = z
  .union([
    z.literal("disabled").transform(() => null),
    z
      .string()
      .trim()
      .min(1, "Warning percentage is required")
      .refine((value) => /^\d+$/.test(value), "Enter a whole percentage")
      .transform(Number)
      .refine((value) => value >= 1 && value <= 100, "Enter a percentage from 1 to 100"),
  ])
  .default("80");
~~~

Add warningPercentage: warningPercentageSchema to the object. Do not change backend NewBudget validation or status calculation.

- [ ] **Step 4: Run focused test and verify pass**

Run the same Vitest command. Expected: all schema tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add apps/frontend/src/features/cash-flow/types/budget.ts apps/frontend/src/features/cash-flow/types/__tests__/budget.test.ts
git commit -m "feat: validate budget warning percentages"
~~~

### Task 2: Wire warning controls through budget creation

**Files:**
- Modify: apps/frontend/src/features/cash-flow/commands/budgets.ts
- Modify: apps/frontend/src/features/cash-flow/components/budget-form-dialog.tsx
- Modify: apps/frontend/src/features/cash-flow/components/__tests__/budget-form-dialog.test.tsx

**Interfaces:**
- createBudget forwards warningPercentage unchanged as number | null.
- The dialog defaults to 80, accepts 1–100, and sends null when disabled.

- [ ] **Step 1: Write failing dialog tests**

Extend the test setup with a successful Budget result and assert the submitted values include warningPercentage: 80. Add a second test that changes the warning input to 65, checks the disable control, and asserts the two submissions are 65 and null respectively. Use the existing Result.success/Result.fail helpers and query controls by accessible labels.

- [ ] **Step 2: Run focused dialog test and verify failure**

Run: pnpm --filter frontend test -- src/features/cash-flow/components/__tests__/budget-form-dialog.test.tsx

Expected: failure because the form has no warning controls/value.

- [ ] **Step 3: Implement minimal form and command changes**

Add warningPercentage: "80" to defaultValues. Add a controlled field:

~~~tsx
<Field data-invalid={Boolean(errors.warningPercentage)}>
  <FieldLabel htmlFor="budget-warning">Warning threshold (%)</FieldLabel>
  <div className="flex items-center gap-2">
    <Input
      id="budget-warning"
      type="number"
      min={1}
      max={100}
      step={1}
      disabled={field.value === "disabled"}
      value={field.value === "disabled" ? "" : field.value}
      onChange={(event) => field.onChange(event.target.value)}
    />
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        aria-label="Disable budget warning"
        checked={field.value === "disabled"}
        onCheckedChange={(checked) => field.onChange(checked === true ? "disabled" : "80")}
      />
      Disable
    </label>
  </div>
  <FieldDescription>Warn when spending reaches this percentage of allowance.</FieldDescription>
  <FieldError errors={[errors.warningPercentage]} />
</Field>
~~~

Wrap the field in Controller with name="warningPercentage". Update the allowance description so it no longer claims warnings are always fixed at 80%. Pass warningPercentage: values.warningPercentage from createBudget.

- [ ] **Step 4: Run focused test and verify pass**

Run the focused dialog test and the schema test. Expected: all pass with no new warnings.

- [ ] **Step 5: Commit**

~~~bash
git add apps/frontend/src/features/cash-flow/commands/budgets.ts apps/frontend/src/features/cash-flow/components/budget-form-dialog.tsx apps/frontend/src/features/cash-flow/components/__tests__/budget-form-dialog.test.tsx
git commit -m "feat: configure budget warning threshold"
~~~

### Task 3: Present cadence, current period, and signed values consistently

**Files:**
- Modify: apps/frontend/src/features/cash-flow/lib/budget.ts
- Create: apps/frontend/src/features/cash-flow/lib/__tests__/budget.test.ts
- Modify: apps/frontend/src/features/cash-flow/screens/budget-screen.tsx
- Modify: apps/frontend/src/features/cash-flow/screens/budget-detail-screen.tsx
- Modify: apps/frontend/src/lib/__tests__/currency.test.ts

**Interfaces:**
- formatBudgetPeriod(start: string, end: string): string returns YYYY-MM-DD to YYYY-MM-DD.
- Screens show budgetCadenceLabel[budget.cadence] plus formatBudgetPeriod(...).

- [ ] **Step 1: Write failing formatter and currency tests**

Create lib/__tests__/budget.test.ts:

~~~ts
import { describe, expect, it } from "vitest";

import { formatBudgetPeriod } from "../budget";

describe("budget display helpers", () => {
  it("formats the complete half-open current period", () => {
    expect(formatBudgetPeriod("2026-07-01T00:00:00", "2026-08-01T00:00:00")).toBe(
      "2026-07-01 to 2026-08-01",
    );
  });
});
~~~

Add to currency.test.ts:

~~~ts
it("keeps negative minor units signed", () => {
  const eurFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  expect(formatCurrencyFromMinor(-1234, "EUR")).toBe(eurFormatter.format(-12.34));
});
~~~

- [ ] **Step 2: Run focused tests and verify formatter failure**

Run: pnpm --filter frontend test -- src/features/cash-flow/lib/__tests__/budget.test.ts src/lib/__tests__/currency.test.ts

Expected: budget formatter test fails because helper is absent; currency test passes, proving existing formatter already preserves the sign.

- [ ] **Step 3: Implement helper and use it in both screens**

Add formatBudgetPeriod to lib/budget.ts, slicing only the date portion of the timezone-less backend values. In the ledger, render cadence and the full range in the period cell. In the detail page, replace the inline range logic with formatBudgetPeriod(period.start, period.end) and label the field Current period. Keep effective allowance, net budget spending, remaining allowance, and status sourced from currentPeriod and formatted through formatCurrencyFromMinor.

- [ ] **Step 4: Run focused tests and verify pass**

Run the same focused command. Expected: formatter and currency tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add apps/frontend/src/features/cash-flow/lib/budget.ts apps/frontend/src/features/cash-flow/lib/__tests__/budget.test.ts apps/frontend/src/features/cash-flow/screens/budget-screen.tsx apps/frontend/src/features/cash-flow/screens/budget-detail-screen.tsx apps/frontend/src/lib/__tests__/currency.test.ts
git commit -m "feat: show budget cadence and current period"
~~~

### Task 4: Verify, review, publish

**Files:**
- No intended source changes; only fix issues found by checks or review.

- [ ] **Step 1: Run frontend formatting, lint, route, type, and test checks**

Run: pnpm --filter frontend check

Expected: format, lint, route generation, type-check, and all frontend tests pass.

- [ ] **Step 2: Run Rust formatting, clippy, and workspace tests**

Run: cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo test --workspace

Expected: all Rust checks pass. If the sandbox again denies loopback bind, rerun the failing server test with approved unsandboxed execution and record the result.

- [ ] **Step 3: Review diff against issue acceptance criteria**

Run git diff origin/main...HEAD --check, git diff --stat origin/main...HEAD, and inspect every changed file. Confirm: default 80/custom 1–100/disabled, upward threshold and status rules remain in core, ledger includes name/cadence/current period/scope/effective allowance/net spending/remaining/status, and signed values render in ledger/detail.

- [ ] **Step 4: Request code review**

Use the code-review workflow against origin/main and the branch HEAD. Fix Critical or Important findings, rerun affected checks, then commit fixes.

- [ ] **Step 5: Push and open PR**

~~~bash
git push -u origin codex/issue-68-budget-status
gh pr create --base main --head codex/issue-68-budget-status --title "feat: surface budget status" --body-file /tmp/issue-68-pr.md
~~~

PR body must link Closes #68, summarize warning configuration and period presentation, list verification commands/results, and mention the original sandbox loopback-bind limitation only if it remains.
