# Recurring form transaction and occurrence separator

## Context

The recurring transaction drawer currently renders transaction template fields
and recurring schedule fields in one continuous field group. The transaction
template ends at Notes. The recurring schedule starts at First occurrence and
continues through Schedule and Occurrences.

## Goal

Add a clear visual separator after Notes so users can identify the boundary
between transaction data and recurring occurrence settings.

## Interaction design

Render the existing feature-local `FieldSeparator` immediately after the Notes
field and before the First occurrence field. The separator has no label and no
interactive behavior. It uses the existing field-group spacing and semantic
border token.

The form order remains:

`Type → Amount → Category → Description → Notes → separator → First occurrence → Schedule → Occurrences`

No labels, form values, validation rules, schedule rules, or submission
behavior change.

## Component and data boundaries

Modify only:

- `apps/frontend/src/features/recurring-transactions/components/recurring-form-drawer.tsx`
- `apps/frontend/src/features/recurring-transactions/components/__tests__/recurring-form-drawer.test.tsx`

Import `FieldSeparator` from the existing shadcn field primitive. Do not
modify shared UI primitives, backend code, routes, commands, or schemas.

Add a focused regression assertion that the separator follows the Notes field
and precedes the First occurrence field. Use the specific `[data-slot="field"]`
containers when checking field order.

## Accessibility and responsive behavior

The separator remains a semantic separator exposed by the existing Base UI
primitive. It has no focus target and does not change keyboard or assistive
technology order. It remains full width inside the drawer field group and
keeps the existing narrow-screen scrolling behavior.

## Verification

Run the focused recurring form drawer test, the frontend check, the layout
detector, React Doctor for changed files, and `git diff --check`. Report live
visual verification separately if the browser tool is unavailable.

## Product pillars

- **Secure / Private:** no new data path, storage, or external service.
- **Reliable:** form values, validation, field order, and submission contracts
  remain unchanged except for the intended visual boundary.
- **Efficient:** one existing primitive adds the boundary without new runtime
  state or dependencies.
