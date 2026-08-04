# Category Parent Combobox

## Context

The category form at `/cash-flow/categories` uses `CategoryDrawerSelect` for
the editable Parent category field. That selector opens a nested drawer. The
field has a short root-category list and needs faster search, direct keyboard
navigation, and visible category identity.

## Design

Add a feature-local `CategoryParentCombobox` built from the existing Base UI
`Combobox` wrappers. Keep `CategoryDrawerSelect` unchanged because it serves
the transaction category filter and multi-select flows.

The trigger keeps `id="category-parent-trigger"`, accessible name
`Parent category`, and `None` as its empty value. A selected parent renders
the existing `CategoryBadge` with the parent display color. The anchored popup
contains a search input, root-category options, and a semantic empty result.
Every option renders as a `CategoryBadge`, exposes its category name to the
combobox semantics, and supports highlighted, selected, mouse, and keyboard
states. Root-only filtering and one-level nesting rules remain unchanged.

Clearing the value returns the form to a root category and preserves the
existing role/color reset behavior. Selecting a parent closes the popup and
lets the form inherit role and color as before. The locked parent display for
new subcategories remains unchanged.

## Accessibility and states

- Trigger exposes combobox semantics, visible focus, and `aria-label`.
- Search input supports text filtering, arrow navigation, Enter selection, and
  Escape dismissal through the shared primitive.
- Selected option retains the primitive check indicator and category badge.
- Empty search results explain the current query.
- Popup closes when the parent drawer closes.

## Verification

Focused tests cover trigger semantics, badge rendering, search filtering,
selection, clearing, popup dismissal, and preservation of role/color form
transitions. Run focused category tests, the frontend gate, and
`git diff --check`. Inspect the final diff for unrelated changes.

## Scope

Frontend-only interaction refinement. No backend, schema, route, persistence,
generic drawer-selector, child-category, or category-list changes.
