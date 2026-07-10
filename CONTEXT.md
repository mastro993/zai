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

**Budget scope**:
The categories whose transactions affect a budget. A selected root category
includes its child categories; no selected categories means all categorized and
uncategorized transactions.

**Budget**:
An independent spending tracker with a recurring allowance and a budget scope.
A transaction may affect every budget whose scope it matches.

**Rollover mode**:
A budget's rule for carrying a remaining allowance or overspending between
periods. It is either off, limited to the previous period, or cumulative.

**Budget period**:
The calendar day, week, month, or year over which a budget allowance is
measured. Weekly boundaries follow the configured week-start convention.

**Net budget spending**:
Matching expense amounts minus matching income amounts within a budget period.
It may be negative when matching income exceeds matching expenses.

**Remaining allowance**:
A budget period's effective allowance minus its net budget spending. It may
exceed the effective allowance or become negative.

**Paused budget**:
A budget made inactive indefinitely until the user explicitly resumes it.

**Budget suspension**:
A bounded interval during which a budget is inactive and after which it resumes
automatically.

**Ended budget**:
A budget made permanently inactive by reaching its scheduled end date.
