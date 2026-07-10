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

**Budget**:
A recurring Cash Flow spending limit with a category scope, a non-negative minor-unit allowance, and a period history.
It has a user-chosen name, initially suggested from its category scope. Saving a budget starts its first period immediately; a draft exists only while the creation form is unsaved. Edits to an active budget take effect immediately in its current period.

**Deactivated budget**:
A retained Budget that does not contribute to statistics or trigger automated behavior. It remains editable and its period history is not frozen.

**Budget scope**:
The categories whose expenses count toward a budget. A root-category scope includes all of that root category's current child categories; an individual child-category scope includes only that child category.
Active budget scopes may overlap, but no two active budgets may share the same scope and cadence.
Deleting a category selected directly by an active budget requires removing or replacing it in every affected budget; deletion from a root-category scope is allowed with a warning. Past budget periods do not change.
Re-parenting a child category requires confirmation when it changes an active root-category scope, listing every affected budget.
