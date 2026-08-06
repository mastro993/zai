# Budget Category Combobox Design

## Goal

Replace the budget form's side-drawer category picker with a searchable,
multiple-selection combobox while preserving the existing budget category
scope semantics.

## Direction

- Add a budget-owned `BudgetCategoryCombobox` built from the installed Base UI
  combobox primitives.
- Keep `CategoryDrawerSelect` unchanged because recurring-transaction flows and
  other category surfaces still depend on its drawer interaction.
- Render selected scopes in the trigger with the existing `CategoryBadge`
  component.
- Render a depth-first flat list of categories so every child appears directly
  after its parent and is visually indented.
- Put the search input inside the combobox popup. Search results retain a
  matching parent when a child matches, so hierarchy context is not lost.

## Selection behavior

- The control supports multiple selection and keeps the current root behavior:
  selecting a root includes all of its descendants.
- A partially selected root remains visible as a partial state while its
  selected children remain independently toggleable.
- Values returned to the form remain canonical: a fully selected root and its
  children are represented by the root ID, matching existing budget storage.
- The trigger continues to show `All categories` when no category scope is
  selected and keeps the existing accessible label contract.

## States and accessibility

- The popup has an accessible combobox label and a labelled search input.
- Keyboard navigation and focus are provided by the Base UI combobox.
- Empty categories retain the current explanation that the budget includes all
  transactions; a search with no matches has a dedicated empty message.
- Category colors and badges remain user-owned data presentation; product
  chrome continues to use semantic design tokens.

## Scope and verification

- Add focused component tests for search, hierarchy order, multi-selection,
  canonical root/child behavior, and the no-category state.
- Update the budget form tests to exercise the new combobox through its public
  role and labels.
- Do not modify backend contracts, shared drawer selector consumers, route
  files, generated route data, or the unrelated existing drawer change.
