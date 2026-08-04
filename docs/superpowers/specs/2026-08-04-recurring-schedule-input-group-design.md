# Recurring schedule input group

## Context

The recurring transaction drawer currently presents schedule mode, interval
value, interval unit, and monthly day as separate controls. This makes the
schedule rule feel fragmented and gives the user two competing concepts for
the same field.

The approved change is a compact single schedule input group for
`/cash-flow/recurring`. It must preserve the existing recurring form schema
and backend schedule contracts.

## Goals

- Present one labeled Schedule group with a leading mode select: `Every` or
  `On`.
- In `Every` mode, show a numeric middle input and a trailing unit select for
  day, week, month, or year.
- Pluralize the visible unit label based on the numeric value: `1 day`,
  `2 days`, and the equivalent week, month, and year labels.
- In `On` mode, show a trailing ordinal select containing `1st` through
  `31st`, followed by static `of the month` text.
- Preserve the previously entered interval value/unit and monthly day when
  switching modes.
- Keep the existing `scheduleKind`, `intervalEvery`, `intervalUnit`, and
  `monthlyDay` form fields and the existing `interval`/`monthlyDay` backend
  rule shapes.

## Interaction design

The group is rendered inside the existing `Schedule` field. Its three visual
segments are:

1. A select controlling the schedule mode.
2. A mode-dependent middle control.
3. A mode-dependent trailing control.

For `Every`, the mode select sets `scheduleKind` to `interval`. The middle
control edits `intervalEvery`; the trailing select edits `intervalUnit`. The
displayed unit options use singular labels when the current interval value is
exactly `1`, and plural labels for all other values, including incomplete or
invalid input while editing.

For `On`, the mode select sets `scheduleKind` to `monthlyDay`. The middle
control is a select backed by the values `1` through `31`, displayed as
ordinals. The trailing segment is non-interactive text reading `of the month`.

Changing modes only changes `scheduleKind`; it does not clear or rewrite the
other mode's form values. Existing form validation remains authoritative for
the submitted schedule rule.

## Component and data boundaries

The schedule group remains feature-local to
`recurring-form-drawer.tsx` unless a small pure helper is needed for ordinal
or pluralized labels. It uses the existing shadcn/Base UI primitives and
React Hook Form `Controller`/`useWatch` patterns. Shared UI primitives are not
modified, and no backend, route, migration, or API changes are required.

The form continues to submit the same values:

- `scheduleKind: "interval"`, `intervalEvery`, and `intervalUnit` for
  `Every`.
- `scheduleKind: "monthlyDay"` and `monthlyDay` for `On`.

## Accessibility and responsive behavior

- The Schedule label remains associated with the control group.
- Each select and input has an accessible name that describes its current
  role.
- Validation state and error messaging remain connected to the relevant
  control without relying on color alone.
- The group uses the existing compact 32px control rhythm and can shrink
  within the drawer without clipping labels or controls.
- The static `of the month` segment is exposed as readable text and is not
  presented as an actionable control.

## Verification

Add focused tests for:

- initial rendering of `Every` and the expected default controls;
- singular and plural unit labels;
- switching to `On` and exposing all ordinal values from `1st` to `31st`;
- switching between modes while preserving each mode's previous values;
- submitted values for both schedule rule shapes;
- existing validation behavior for invalid interval and monthly-day values.

Run the focused recurring form test, the relevant frontend checks, and
`git diff --check`. Visual verification should confirm the group reads as one
control and remains usable at the supplied desktop viewport.

## Product pillars

- **Secure / Private:** no new data path or external service is introduced.
- **Reliable:** the existing validated schedule model and backend contract are
  preserved; mode switching does not silently discard values.
- **Efficient:** the form uses isolated React Hook Form subscriptions and
  feature-local rendering without broad shared-component changes.
