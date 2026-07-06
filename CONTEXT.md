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
