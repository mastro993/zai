# Zai

Personal finance context for tracking money movement and related organization.

## Language

**Cash flow**:
Money movement over time, grouped as the app area that contains transactions and categories.
_Avoid_: Transactions as the top-level area

**Category**:
A user-defined grouping for cash flow transactions.
_Avoid_: Transaction category in user-facing language

**Root category**:
A category without a parent category. Root category names are unique among other
root categories.

**Child category**:
A category nested under a root category. Child category names are unique among
children of the same root category.

**Effective category color**:
The color shown for a category. A root category uses its own color; a child
category uses its parent category's color.

**Category path**:
The category's identity in the category hierarchy. A root category's path is its
own name; a child category's path is its root category name plus its own name.

**Category role**:
A root category's classification as Spending or Income, inherited by its child
categories. It determines whether income offsets spending in a Spending budget;
it never changes how an expense contributes.

**Budget scope**:
The categories whose transactions are eligible to affect a budget. A selected
root category includes its child categories; no selected categories includes all
categorized and uncategorized transactions. Category role and budget measurement
mode determine whether an eligible income contributes. Current category
identities and hierarchy determine membership for every period, so category
changes may rewrite closed results.

**Budget-impacting category change**:
A category reparent, deletion, or future merge that can change budget matching
or history and therefore requires user warning. Renaming and recoloring do not;
deletion is blocked while the category is directly selected by a current budget
configuration, but indirect and historical coverage does not block it.

**Budget**:
An independent recurring allowance tracker with a budget scope and measurement
mode. A transaction may affect every budget whose scope it matches.

**Budget name**:
The required, trimmed, case-insensitively unique name among non-tombstoned
budgets that identifies a budget in lists, alerts, and confirmations. A
tombstoned budget retains its former name as history without reserving it.
Renaming changes the budget's current identity metadata without revising period
configuration or recalculating results.

**Budget cadence**:
The fixed calendar unit—day, week, month, or year—that defines a budget's
periods for its entire lifetime.

**Budget configuration**:
The allowance, scope, measurement mode, rollover mode, and warning threshold
used to calculate a budget period. Each period has one effective configuration:
edits replace the current period's version, while closure makes its final version
immutable.

**Budget measurement mode**:
The rule that determines how eligible income contributes to net budget spending.
Spending counts income in Spending categories as refunds; Net cash flow counts
all eligible income. Spending is the default.

**Matching transaction**:
A non-deleted transaction whose timestamp falls within a budget period and whose
category belongs to the budget scope. An uncategorized transaction matches only
an all-categories scope. Measurement mode, category role, and transaction type
determine its contribution; a transaction may match while contributing nothing.

**Recurring transaction**:
A retained schedule and transaction template that produces linked transactions
on due occurrences through its lifecycle.
_Avoid_: Recurrent transaction, scheduled transaction

**Recurring transaction name**:
The required, trimmed, case-insensitively unique name among non-tombstoned
recurring transactions, independent from the optional description copied into
generated transactions. A tombstone releases the name; stopped and completed
history retains it.

**Catch-up generation**:
The creation of every due, not-yet-created recurring transaction occurrence after
Zai becomes able to process schedules again. Generated transactions retain their
originally scheduled dates regardless of what initiates processing.

**Scheduled occurrence**:
A single due instance identified by its intended local date and time plus the
time zone captured by its recurring transaction. It resolves to a UTC instant,
shifting through a daylight-saving gap or choosing the earlier repeated instant;
its generated transaction retains that resolved instant after catch-up.

**Interval recurrence**:
A recurring transaction rule that schedules an occurrence every fixed number of
calendar days, weeks, months, or years from its first scheduled occurrence.

**Monthly-day recurrence**:
A recurring transaction rule that schedules one occurrence on a selected day
number of every month, independently of when the rule was created.

**Calendar-clamped occurrence**:
An occurrence whose anchored day does not exist in its target month or year and
therefore falls on that period's last valid day. Later occurrences continue from
the original anchor rather than from the clamped date.

**Recurring transaction lifecycle**:
The retained state of a recurring transaction: active, paused, stopped,
completed, or tombstoned. No lifecycle transition hard-deletes the recurring
transaction or its links to generated transactions.

**Paused recurring transaction**:
A recurring transaction that temporarily suppresses due occurrences. Occurrences
due while paused are skipped without moving the calendar anchor or consuming a
finite recurrence's remaining count, and are not generated after resumption.

**Stopped recurring transaction**:
A user-ended recurring transaction that can no longer generate occurrences or
resume, while remaining visible as history.

**Completed recurring transaction**:
A finite recurring transaction that fulfilled its configured total and can no
longer generate occurrences or resume, while remaining visible as history.

**Tombstoned recurring transaction**:
A soft-deleted recurring transaction hidden from every user-facing view. Its
record and occurrence links remain only for data integrity and duplicate
prevention; it can never generate occurrences or resume.

**Recurring transaction template**:
The transaction payload copied into future generated transactions. Template
changes affect only future occurrences; each generated transaction remains an
independently editable snapshot linked to its recurring transaction.

**Fulfilled occurrence**:
A scheduled occurrence linked to exactly one transaction, either by automatic
generation or by adopting an existing transaction. It remains fulfilled if that
transaction is later edited or tombstoned, so processors cannot recreate it.

**Adopted occurrence**:
A fulfilled occurrence whose transaction existed before the recurring transaction
was created. It counts toward a finite total but emits no recurring occurrence
alert because no transaction was automatically inserted.

**Projected occurrence**:
A future occurrence computed from an active recurring transaction for forecasting.
It may contribute to a budget projection but does not affect actual transactions,
budget results, statuses, rollover, or alerts until it becomes due and fulfilled.

**Recurring occurrence alert**:
The durable domain alert created with one automatically generated occurrence. It
identifies the generated transaction and recurring transaction; finite recurrences
also report the generated position, total, and remaining count.

**Rollover mode**:
A budget's rule for carrying a remaining allowance or overspending between
periods. Off carries nothing. Previous-period-only adds the immediately
preceding period's base allowance minus its net budget spending, excluding any
rollover that period received. Cumulative adds the preceding period's remaining
allowance. A budget's first period has zero carry. Every period participates
even when it has no matching transactions; pausing does not break the rollover
chain. A historical result correction recalculates every later period whose
rollover depends on it.

**Effective allowance**:
A budget period's base allowance plus the carry determined by its rollover mode.
It may be negative when carried overspending exceeds the base allowance.

**Base allowance**:
A non-negative minor-unit amount assigned to each active budget period. Zero is
a valid no-spending target: any positive net budget spending is overspent when
the effective allowance remains zero.

**Budget period**:
The calendar day, week, month, or year over which a budget allowance is
measured. It is a half-open local-calendar interval from the period's start at
00:00 up to, but excluding, the next period's start at 00:00. Weekly boundaries
consume an explicit week-start convention, currently Monday. A budget created
mid-period uses the full containing period and full base allowance, includes
matching transactions from before creation within that period, and has no
predecessor from which to receive rollover.

**Closed budget period**:
A budget period whose end boundary has passed. Its budget configuration is
immutable, while corrections to source transactions may recalculate its result.

**Net budget spending**:
The signed sum of matching transaction contributions within a budget period,
without clamping. Expenses add. In Spending mode, income subtracts only in a
Spending category; in Net cash flow mode, all matching income subtracts. It may
be negative when contributing income exceeds expenses.

**Remaining allowance**:
A budget period's effective allowance minus its net budget spending. It may
exceed the effective allowance or become negative.

**Budget status**:
A budget period is overspent when net budget spending exceeds its effective
allowance. Otherwise it is warning when a configured percentage threshold has
been reached against a positive effective allowance; percentage warnings are
not evaluated for zero or negative effective allowances. All other periods are
on track. Overspent takes precedence over warning.

**Warning threshold**:
An optional whole percentage from 1 through 100 used to determine a budget
period's warning status. New budgets enable it at 80 percent by default, and the
user may change or disable it. Its minor-unit trigger is the effective allowance
multiplied by the percentage, divided by 100, and rounded upward. Warning begins
when net budget spending reaches that trigger. Disabling it does not disable
overspent status.

**Paused budget**:
A budget hidden from active views with its warnings and alerts suppressed until
the user resumes it; this current state changes immediately and is not historical.
Pausing does not alter period calculations or rollover. Resuming surfaces the
current status and emits at most one current alert without replaying suppressed
alerts.

**Budget deletion**:
The confirmed tombstoning of a budget. A tombstoned budget is hidden from normal
reads and excluded from period advancement, projection repair, rollover, and
alerts, while its identity, configuration, and calculated history are retained
for future synchronization. Budgets are never hard-deleted and cannot currently
be restored. Source transactions and categories remain unchanged.
