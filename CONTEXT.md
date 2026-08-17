# Zai

Personal finance context for tracking money movement and related organization.

## Language

**Cash flow area**:
The user-interface navigation area that presents transactions, categories,
recurring transactions, forecasts, and budgets together. This grouping is a
presentation convention; the features remain distinct.
_Avoid_: Cash flow feature

**Category**:
A user-defined grouping for transactions.
_Avoid_: Transaction category in user-facing language

**Transaction currency**:
The currency in which a transaction's amount is recorded. Each transaction
retains its transaction currency and original amount.
_Avoid_: Original currency

**Default currency**:
The single user-selected currency in which Zai displays monetary values and
cross-currency results, including budgets, projections, statistics, and charts.
It preselects the first transaction currency in a transaction addition flow.
When a transaction has another transaction currency, its original amount is
visible only in transaction details and the edit form. The user may change the
default currency at any time; that explicit change re-expresses app values and
history while preserving original amounts and transaction currencies. The old
default currency remains active until all new results are ready, and a failed
change leaves it active.
_Avoid_: Reporting currency, base currency, home currency

**Initial currency setup**:
The first-use step in which the user selects the default currency. Zai
preselects the currency inferred from the device's current locale, but the user
must confirm or change it before setup completes.
_Avoid_: Silent locale currency selection

**Legacy EUR migration**:
The silent assignment of EUR as the transaction currency for all monetary
values created before Zai stored currencies explicitly. It preserves each
original amount and does not ask the user to reinterpret existing history.
_Avoid_: Locale-based legacy currency

**Supported currency**:
An active ISO 4217 fiat currency for which Zai can obtain complete historical
exchange-rate coverage. Cryptocurrencies, commodities, obsolete currencies,
and user-defined currency codes are not supported currencies.
_Avoid_: Crypto asset, custom currency

**Enabled currency**:
A currency the user has added and can select as a transaction currency or the
default currency. It must have complete historical exchange-rate coverage
before use. The user may add enabled currencies at any time.
_Avoid_: Added currency, active currency

**Historical exchange-rate coverage**:
The exchange-rate history required to convert an enabled currency across every
period covered by the user's financial history. Coverage is complete only when
no required period lacks a usable rate.
_Avoid_: Partial currency history

**Currency addition**:
The process that retrieves and validates complete historical exchange-rate
coverage before a currency becomes enabled. While this work continues, the
currency is identified as Adding currency and cannot be selected. If complete
coverage cannot be obtained, addition fails and identifies the missing periods;
partial activation is never allowed.
_Avoid_: Currency activation before backfill

**Import currency preparation**:
The combined preparation of every new, disabled, or insufficiently covered
currency required by a transaction import. The preview lists all currency
changes and coverage ranges. One user confirmation prepares all currencies and
imports all transactions as one atomic operation.
_Avoid_: Silent currency addition, per-currency import confirmation

**Currencyless transaction import**:
A transaction import whose source has no currency column. The user selects one
transaction currency for all rows. Zai preselects the default currency, but the
user must confirm or change it. If a currency column exists, a row with no
currency is invalid.
_Avoid_: Silent default-currency assignment

**Atomic transaction import**:
A confirmed transaction import that commits every prepared currency, category,
transaction, exchange rate, and affected result together, or commits none of
them. Empty rows and identified duplicates are explicit skips. Any other invalid
row blocks the import until the user corrects or removes it.
_Avoid_: Partial transaction import

**Full-fidelity transaction export**:
The single transaction export format that preserves each exact original amount,
transaction currency, fixed transaction exchange rate, rate date, rate state,
and supplied or manual origin. A later import can restore the exact monetary
meaning. A converted default-currency display value never replaces those source
values.
_Avoid_: Display-only transaction export, simplified transaction export

**Disabled currency**:
A previously enabled currency that cannot be selected for new transactions or
as the default currency. Its original amounts, exchange rates, and historical
use remain unchanged. After a warning, existing recurring transactions continue
to use it and Zai continues to maintain their required rates. Disabling is
reversible; the default currency cannot be disabled.
_Avoid_: Deleted currency, removed currency

**Last-used transaction currency**:
The transaction currency selected for the most recent transaction in the active
app session. It preselects later transaction currencies across transaction
addition flows until the app closes; without one, the default currency is
preselected.
_Avoid_: Default currency

**Transaction exchange rate**:
The date-specific conversion rate associated with a completed transaction. It
does not change when later market rates change, so completed budget and
statistical results remain stable. An explicit default currency change may
re-express it for the new default currency. Zai supplies a rate by default, but
the user may replace it with a manual exchange rate.
_Avoid_: Live rate for completed transactions

**Manual exchange rate**:
A transaction exchange rate supplied by the user instead of the default rate.
An exchange rate mapped from an external transaction import is a manual exchange
rate. Its manual origin and direction remain part of the transaction so Zai can
distinguish it from a supplied rate.
_Avoid_: Custom currency

**Rate-sensitive transaction edit**:
A change to a completed transaction's date or transaction currency. Zai obtains
a new date-specific transaction exchange rate; replacing a manual exchange rate
requires a user warning. Editing only the original amount keeps the existing
rate.
_Avoid_: Rate refresh after every transaction edit

**Exchange-rate pending transaction**:
A completed transaction in an enabled currency that needs a transaction
exchange rate but does not yet have one because of a temporary rate-lookup
failure. Zai retains its transaction currency and original amount, retries the
rate lookup, and allows a manual exchange rate. Until resolution, any affected
cross-currency result is incomplete rather than estimated.
_Avoid_: Failed transaction, unconverted transaction

**Incomplete cross-currency result**:
A budget, projection, statistic, chart value, or other aggregate that cannot be
fully calculated because at least one contributing transaction or projected
occurrence lacks a required exchange rate, or because it depends on such a
period through rollover. It may show the known converted sum. Zai never claims
a complete status, remaining allowance, or alert from it, and never presents a
guessed value as complete.
_Avoid_: Estimated result

**Projection exchange rate**:
The latest available conversion rate used for a projected occurrence or a
future projected allowance. A later rate may change a projection but never
changes a completed transaction or its results.
_Avoid_: Transaction exchange rate

**Live exchange-rate refresh**:
Automatic retrieval of projection exchange rates when the app starts, returns
to the foreground, and every 15 minutes while its process remains active,
including while hidden or minimized. It stops when the app quits. When refresh
is unavailable, Zai identifies the cached rate with its timestamp and stale
status.
_Avoid_: Continuous exchange-rate streaming, refresh after app quit

**Exchange-rate details**:
The original amount, transaction currency, fixed transaction exchange rate,
rate date, and supplied or manual origin shown in transaction details and the
edit form. Currency settings show historical coverage, last refresh, and
current status. Other app surfaces show monetary values only in the default
currency.
_Avoid_: Dedicated exchange-rate screen

**Exchange-rate refresh failure alert**:
The durable, user-visible domain alert for a persistent live exchange-rate
refresh failure that affects cross-currency results. A transient failure shows
only stale status. Repeated failures update one alert, and successful refresh
resolves it.
_Avoid_: Alert for every refresh attempt, silent persistent failure

**Root category**:
A category without a parent category. Root category names are unique among other
root categories.

**Child category**:
A category nested under a root category. Child category names are unique among
children of the same root category.

**Category color**:
A user-selected presentation value assigned to a root category. The interface
and user-authored imports call this value a color. It is stored and transported
as a validated `#RRGGBB` HEX color. A child category inherits its root
category's color.
_Avoid_: Category hue in user-facing copy, named color

**Effective category color**:
The color used to present a category. A root category uses its own stored HEX
color; a child category uses its root category's color. The frontend extracts
the HEX color's hue and derives theme-aware badge colors from it; an achromatic
HEX color produces the neutral badge treatment.
_Avoid_: Effective category hue in user-facing copy

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
or history and therefore requires user warning. Renaming and color changes do not;
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
on due occurrences through its lifecycle. It has no separate name; its
user-facing label is the template description.
_Avoid_: Recurrent transaction, scheduled transaction, recurring transaction
name

**Recurring transaction description**:
The required, trimmed, non-empty description on the recurring transaction
template. It is the only user-facing label for the recurring transaction and is
copied into each generated transaction as that transaction's description.
Descriptions need not be unique among recurring transactions.
_Avoid_: Recurring transaction name, title

**Recurring transaction creation**:
Persisting a new recurring transaction from a transaction template plus a
required schedule. Creation does not insert a transaction by itself; due
occurrences, including the first when already due or in the past, are fulfilled
through generation, including catch-up. The first scheduled occurrence may be
past, present, or future. Automatically generated catch-up occurrences still
create recurring occurrence alerts; adopted occurrences stay silent.

**Recurring transaction adoption**:
Creating a recurring transaction from an existing transaction reviewed by the
user. The source transaction becomes occurrence 1, its transaction date and time
anchor the schedule, and its payload becomes the recurring transaction template;
confirmation fails if the source changes after review.
_Avoid_: Adopt transaction

**Catch-up generation**:
The creation of every due, not-yet-created recurring transaction occurrence after
Zai becomes able to process schedules again, stopping when a finite total is
reached. Generated transactions retain their originally scheduled local date and
time regardless of what initiates processing.

**Scheduled occurrence**:
A single due instance identified by a floating local calendar date and time,
without a stored or selectable time zone. It becomes due according to the
device's current local clock, so future occurrences follow the device when its
time zone changes.

**Interval recurrence**:
A recurring transaction rule that schedules an occurrence every fixed number of
calendar days, weeks, months, or years from its first scheduled occurrence.

**Monthly-day recurrence**:
A recurring transaction rule that schedules one occurrence on a selected day
number of every month, independently of when the rule was created.

**Recurring schedule**:
The required timing rule for a recurring transaction: either an interval
recurrence or a monthly-day recurrence, a first scheduled occurrence, and an
optional finite total. These are the only schedule kinds.

**Finite recurrence**:
A recurring transaction limited to a configured total of N fulfilled
occurrences, where N is a positive integer and the first occurrence counts as
1 of N. Automatic generation and adopted occurrences both consume the total.
Without a total, the recurrence is infinite.

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
The transaction payload copied into future generated transactions: required
description, original amount, transaction currency, type, optional category,
and optional notes. It has no transaction date, time, or fixed exchange rate;
each fulfillment takes its date and time from its scheduled occurrence and
locks that occurrence's date-specific transaction exchange rate. Template
changes affect only future occurrences; each generated transaction remains an
independently editable snapshot linked to its recurring transaction. A manual
exchange rate can correct a fulfilled transaction but never the template.

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
Its conversion uses the projection exchange rate rather than a transaction
exchange rate.

**Budget projection**:
A snapshot-derived forecast over a bounded rolling device-local calendar window.
The window starts from one sampled local-clock observation and ends at the same
local time after the selected number of calendar months, retaining the
day-of-month or clamping to the target month's last valid day. It combines
persisted budget activity converted at each transaction exchange rate with
projected occurrences and future allowances converted at the projection
exchange rate. It may derive hypothetical rollover and status without changing
actual budget state or emitting alerts.

**Recurring occurrence alert**:
The durable domain alert created with one automatically generated occurrence. It
identifies the generated transaction and recurring transaction; finite recurrences
also report the generated position, total, and remaining count.

**Generation-blocked recurring transaction**:
An active recurring transaction parked at an occurrence generation failure. It
needs attention and cannot fulfill later occurrences until recovery succeeds.

**Occurrence generation failure**:
A deterministic failure that prevents one scheduled occurrence from being
fulfilled without allowing later occurrences of the same recurring transaction
to bypass it.

**Recurring generation failure alert**:
The durable domain alert created for an occurrence generation failure. Failed
retries update it, and successful recovery resolves it without creating a
separate recovery alert.

**Rollover mode**:
A budget's rule for carrying a remaining allowance or overspending between
periods. Off carries nothing. Previous-period-only adds the immediately
preceding period's converted base allowance minus its converted net budget
spending, excluding any rollover that period received. Cumulative adds the
preceding period's converted remaining allowance. Carry always uses the same
default-currency restatement as the period that receives it. A budget's first
period has zero carry. Every period participates even when it has no matching
transactions; pausing does not break the rollover chain. An incomplete
predecessor makes every later dependent period incomplete. A historical result
correction recalculates every later period whose rollover depends on it.

**Effective allowance**:
A complete budget period's converted base allowance plus the carry determined
by its rollover mode. It may be negative when carried overspending exceeds the
base allowance. An incomplete period does not claim an effective allowance.

**Base allowance**:
A non-negative authored allowance assigned to each active budget period. Zero is
a valid no-spending target: any positive net budget spending is overspent when
the effective allowance remains zero.

**Authored allowance**:
The base allowance as the user entered it, stored as money in the default
currency at the time that configuration version was written. Closed period
configuration does not change.

**Converted allowance**:
The authored allowance restated in the current default currency. Actual periods
use the period-start rate of the same class as a transaction exchange rate;
future projected periods use the projection exchange rate.

**Budget period**:
The calendar day, week, month, or year over which a budget allowance is
measured. It is a half-open device-local calendar interval from the period's
start at 00:00 up to, but excluding, the next period's start at 00:00. Stored
transaction dates and times never shift when the device's time zone changes.
Weekly boundaries consume an explicit week-start convention, currently Monday.
A budget created mid-period uses the full containing period and full base
allowance, includes matching transactions from before creation within that
period, and has no predecessor from which to receive rollover.

**Budget period timeline**:
The ordered, gap-free sequence of a budget's calculated periods. For an active
budget it begins with the period containing its creation and extends through the
period current at the operation's observation time. It includes periods without
matching transactions and periods elapsed while the budget is paused. A deleted
budget retains its timeline without advancing it. Rollover makes later periods
depend on earlier results, so correcting one period may change the timeline's
suffix.

**Closed budget period**:
A budget period whose end boundary has passed. Its budget configuration is
immutable, while corrections to source transactions may recalculate its result.

**Net budget spending**:
The signed sum of matching transaction contributions within a budget period,
converted into the default currency, without clamping. Expenses add. In
Spending mode, income subtracts only in a Spending category; in Net cash flow
mode, all matching income subtracts. It may be negative when contributing
income exceeds expenses. An exchange-rate pending transaction adds nothing to
the sum and makes the period an incomplete cross-currency result.

**Remaining allowance**:
A complete budget period's effective allowance minus its net budget spending.
It may exceed the effective allowance or become negative. An incomplete period
does not claim a remaining allowance.

**Budget status**:
A complete budget period is overspent when net budget spending exceeds its
effective allowance. Otherwise it is warning when a configured percentage
threshold has been reached against a positive effective allowance; percentage
warnings are not evaluated for zero or negative effective allowances. All other
complete periods are on track. Overspent takes precedence over warning. An
incomplete period has no claimed status.

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
