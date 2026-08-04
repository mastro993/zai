# Category Role Combobox

## Context

The root-category form at `/cash-flow/categories` currently renders the Role
field with the shared `DrawerSelect`. The selector opens a nested drawer even
though Role has only two fixed choices. The role option model already contains
the intended Hugeicons and concise descriptions, but the field does not expose
the requested shadcn combobox interaction.

## Design

Replace only the editable Role control in
`apps/frontend/src/features/categories/components/category-form-drawer.tsx`
with the project’s shadcn Base UI `Combobox` composition. The trigger keeps
the existing `category-role` id and `Category role` accessible name, displays
the selected role’s icon and label, and remains a compact outline control
aligned with the surrounding form fields.

The popup is an anchored combobox list. It contains one rich item per role:

- Spending — icon `ShoppingBag01Icon` — “Tracks outflows and can include
  refunds.”
- Income — icon `MoneyReceive01Icon` — “Identifies genuine income only.”

Each item remains keyboard navigable, exposes the role label as its accessible
name, shows the icon as decorative content, and uses the primitive’s selected
indicator. There is no search input because both fixed options are visible at
once; the control still uses the combobox primitive and supports keyboard
opening and selection.

The shared `CATEGORY_ROLE_OPTIONS` data remains the single source of truth for
labels, icons, descriptions, and values. The React Hook Form `Controller`
continues to own the selected `CategoryRole`, validation, `onBlur`, and submit
behavior. Child categories keep their existing read-only inherited-role field,
and the parent-category selector keeps its nested drawer behavior.

## Component boundary and data flow

Add the shadcn `Combobox` UI primitive at
`apps/frontend/src/components/ui/combobox.tsx`. The primitive should be copied
from the project’s Base UI + Hugeicons shadcn configuration without applying
the unrelated generated `input-group.tsx` change shown by the CLI preview.

The form passes the current `field.value` into the combobox, renders the
matching option in the trigger, and forwards each selected `CategoryRole` to
`field.onChange`. Selecting an item closes the popup. No backend command,
schema, route, persistence, or category-role business rule changes are needed.

## States and accessibility

- Default: selected role is visible with its icon and the trigger has the
  existing `Category role` accessible name.
- Open: the popup is anchored to the trigger and has a labelled list of role
  items; focus and highlighted states use semantic shadcn tokens.
- Selected: the active item shows the primitive’s check indicator while its
  icon and description remain readable.
- Invalid: the existing field validation state continues to flow to the
  combobox control through `aria-invalid`.
- Parent drawer closed: the combobox popup must not remain open.

The trigger and items must retain visible keyboard focus, correct combobox/
option semantics, and a logical tab order. Icons are decorative because labels
and descriptions carry the meaning.

## Verification

Update focused tests to prove that the category form renders a combobox trigger,
both role labels/descriptions and icons, and the selected value. Exercise
selection of Income and confirm that the form submits the corresponding
`role` while the popup closes. Run the focused category tests, the frontend
type/build gate appropriate to the workspace, and `git diff --check`. Inspect
the final source diff for unrelated changes.

## Scope constraints

This is a frontend-only interaction refinement. Do not generalize
`DrawerSelect`, change the parent category flow, alter the child inherited-role
display, modify role copy or schema semantics, or overwrite the existing
`input-group.tsx` primitive as a side effect of installing Combobox.
