# Budget Income Treatment Design

## Status

Approved on 2026-07-11.

## Context

The Budgets specification initially defined an empty scope as all categorized
and uncategorized transactions and calculated net budget spending as matching
expenses minus matching income. For an all-categories budget, salary therefore
reduced net budget spending and increased remaining allowance. That behavior is
useful for an intentional net-cash-flow tracker but surprising for the default
spending-budget use case.

Users also record refunds as income in the original spending category. Ignoring
all income would exclude salary but would incorrectly prevent refunds from
reducing spending.

## Decision

Add two related concepts:

1. Every root category has a Category role: `Spending` or `Income`. Child
   categories inherit the root role.
2. Every budget configuration has a Budget measurement mode: `Spending` or
   `Net cash flow`. Spending is the default.

Category role describes the meaning of income assigned to that category. Budget
measurement mode describes whether the budget measures spending or intentional
net cash flow. These concerns remain separate from transaction type and budget
scope.

## Calculation Rules

Budget scope continues to decide transaction eligibility by timestamp and
category. A selected root includes its children. An empty category selection
includes all categorized and uncategorized transactions.

For a Spending budget:

- Every matching expense adds its amount to net budget spending, regardless of
  category role.
- Matching income in a Spending category subtracts its amount as a refund or
  spending reversal.
- Matching income in an Income category contributes zero.
- Uncategorized income contributes zero.

For a Net cash flow budget:

- Every matching expense adds its amount.
- Every matching income subtracts its amount, regardless of category role.
- Uncategorized income contributes when the scope includes all categories.

Zero-value transactions may match and contribute zero. Contributions use the
existing checked signed minor-unit arithmetic. Net budget spending remains
unclamped and may be negative. Remaining allowance, warning, overspent,
rollover, alert, and projection rules do not otherwise change.

### Canonical Example

An all-categories Spending budget receives these transactions:

- €100 expense in the Spending category Groceries: `+€100`.
- €40 income in Groceries, representing a refund: `-€40`.
- €3,000 income in the Income category Salary: `€0`.

Net budget spending is €60. The salary does not increase remaining allowance.
Changing the same budget period to Net cash flow makes the salary contribute
`-€3,000`, producing net budget spending of `-€2,940`.

## Effective Dating and Historical Behavior

Measurement mode belongs to Budget configuration. Changing it replaces the
open current period's configuration and recalculates the affected rollover
suffix. Closed periods retain the measurement mode frozen in their final
configuration.

Category role is current category meaning, like category hierarchy. Changing a
root role requires explicit budget-impact confirmation, changes the inherited
role of all children, and atomically recalculates every affected current and
closed result. Rollover repair propagates forward according to the existing
dependency rules.

A role change does not alter a budget's category selections. Scope membership
remains stable; only the contribution of matching income may change.

## Persistence and Migration

- Persist Category role on root categories. Child categories do not store an
  independent role.
- Migrate every existing root category to Spending.
- Require a role when creating a new root category.
- Persist Budget measurement mode in each effective-dated budget
  configuration.
- New budgets default to Spending when the mode is omitted.

Migrating existing roots to Spending is intentionally non-blocking. Its known
trade-off is that income such as salary continues to offset spending until the
user changes the corresponding root to Income. The UI must make role visible
and editable so users can correct those categories.

## Service and Transport Behavior

Category create and update contracts expose the root Category role. Child
responses expose the inherited effective role so clients can render behavior
without reconstructing it. Attempts to assign an independent child role fail
validation.

Budget create and update contracts expose measurement mode as part of the
complete editable configuration. Omitting it during create selects Spending;
updates continue to replace the complete current configuration.

Changing a root role uses the existing category-impact confirmation flow. An
unconfirmed change that affects budgets returns
`budgetImpactConfirmationRequired` with affected budget identities. The
confirmed category mutation and all projection repairs commit in the same
serialized SQLite transaction. Tauri and Axum preserve equivalent behavior and
structured errors.

## User Experience

- Root category forms require a Spending or Income role.
- Child category forms show the inherited role as read-only.
- Existing roots appear as Spending after migration and can be changed through
  the normal edit flow.
- A role-change confirmation explains that current and historical budget
  results may change and identifies affected budgets.
- Budget create and edit forms offer “Track spending” and “Track net cash
  flow.” Track spending is selected by default.
- Budget detail and history identify the effective measurement mode so negative
  net budget spending is understandable when Net cash flow was chosen.

## Testing

The shared Budgets scenario corpus gains the following cases:

- Salary income in an Income category contributes zero to Spending and
  subtracts in Net cash flow.
- Income in a Spending category reduces spending as a refund in both modes.
- Expenses contribute in both modes regardless of category role.
- Uncategorized expenses contribute to an all-categories scope in both modes;
  uncategorized income contributes only in Net cash flow.
- Explicit scopes continue to control eligibility independently of role.
- Existing roots migrate to Spending, and new roots require a role.
- Child categories inherit the root role and reject independent assignment.
- Measurement-mode changes replace only the current configuration and repair
  dependent rollover periods.
- Confirmed role changes recalculate affected current and closed periods and
  dependent rollover; unconfirmed changes return the structured impact error.
- Failed role changes or projection repairs roll back the category mutation and
  every calculated result.
- Tauri and Axum serialize roles, modes, successes, and errors equivalently.
- Frontend tests cover defaults, inherited role presentation, role-impact
  confirmation, and clear display of each measurement mode.

## Out of Scope

- Linking a refund to its original expense.
- Adding a separate Refund transaction type or transaction-level refund flag.
- Inferring category roles from transaction history.
- Giving child categories roles that differ from their root.
- Automatically changing category roles based on later transactions.
- Changing any existing rollover, warning threshold, status precedence, alert,
  tombstone, or period-advancement rule beyond recalculating with the resolved
  income contribution.
