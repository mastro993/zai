---
name: Zai
description: Local-first financial workspace with quiet green utility surfaces and data-led structure.
colors:
  ledger-green: "oklch(0.476 0.078 162.2)"
  ledger-white: "oklch(1 0 0)"
  ledger-ink: "oklch(0.25 0.023 162.2)"
  secondary-sage: "oklch(0.955 0.008 162.2)"
  muted-sage: "oklch(0.97 0.002 162.2)"
  accent-mist: "oklch(0.965 0.002 162.2)"
  muted-ink: "oklch(0.52 0.016 162.2)"
  hairline: "oklch(0.925 0.004 162.2)"
  audit-red: "oklch(0.584 0.239 28.5)"
  night-canvas: "oklch(0.15 0.008 162.2)"
  night-surface: "oklch(0.17 0.008 162.2)"
  night-popover: "oklch(0.18 0.008 162.2)"
  night-ink: "oklch(0.98 0 0)"
  chart-ledger-1: "oklch(0.25 0.078 162.2)"
  chart-ledger-2: "oklch(0.35 0.078 162.2)"
  chart-ledger-3: "oklch(0.55 0.078 162.2)"
  chart-ledger-4: "oklch(0.75 0.078 162.2)"
  chart-ledger-5: "oklch(0.85 0.078 162.2)"
typography:
  display:
    fontFamily: '"Mona Sans", sans-serif'
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Mona Sans", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Geist", sans-serif'
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: '"Geist", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Geist", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
  pill: "2rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  empty-y: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.ledger-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  badge-default:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.ledger-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
    height: "2rem"
  dialog-surface:
    backgroundColor: "{colors.ledger-white}"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    padding: "0.625rem 1.5rem"
  category-list:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0"
---

# Design System: Zai

## Overview

**Creative North Star: "The Quiet Ledger"**

Zai treats financial work as a careful desktop utility: quiet enough for long
review sessions, structured enough that data never feels loose. The visual
language is a low-chroma green axis on white or green-black canvases, softened
by squircle corners on controls while work surfaces remain visibly ordered.

The source defines Geist for operational text and Mona Sans for larger heading
roles, with an Inter variable font import as the shipped fallback asset. The
interface favors compact controls, semantic borders, and restrained state
changes over decorative presentation. Light and dark themes keep the same hue
logic while changing surface contrast for the working environment.

**Key Characteristics:**

- Low-chroma ledger green for primary actions, focus, charts, and selection
- Geist operational type with Mona Sans reserved for display and headline roles
- 32px controls, 12px base squircles, and 20px categorical pills
- Full-height shell with a 16rem sidebar, 3rem collapsed rail, and 48px route bar
- Flat bordered work surfaces; shadows belong to temporary layers
- Accessible state feedback, inline SVG iconography, and reduced-motion fallbacks

## Colors

The palette is one green-tinted continuum: ledger green carries identity, sage
surfaces reduce contrast between working regions, and hairline borders preserve
structure without visual noise. Dark mode changes lightness and surface depth
while retaining the same green hue axis.

### Primary

- **Ledger Green** (`oklch(0.476 0.078 162.2)`): Primary buttons, focus rings,
  selected controls, success feedback, and the shared chart family.
- **Ledger White** (`oklch(1 0 0)`): Light canvas and foreground on primary
  actions.

### Secondary

- **Secondary Sage** (`oklch(0.955 0.008 162.2)`): Quiet secondary controls and
  selected or supporting surfaces.

### Tertiary

- **Audit Red** (`oklch(0.584 0.239 28.5)`): Destructive actions, validation,
  and error copy. Use tinted backgrounds for destructive surfaces.

### Neutral

- **Ledger Ink** (`oklch(0.25 0.023 162.2)`): Primary light-theme text and
  foreground for controls.
- **Muted Ink** (`oklch(0.52 0.016 162.2)`): Supporting copy, placeholders,
  metadata, and inactive states.
- **Muted Sage** (`oklch(0.97 0.002 162.2)`): Quiet bands, hover surfaces, and
  low-emphasis grouping.
- **Accent Mist** (`oklch(0.965 0.002 162.2)`): Sidebar and active navigation
  surface.
- **Hairline** (`oklch(0.925 0.004 162.2)`): Borders, input strokes, dividers,
  and list structure.
- **Night Canvas**, **Night Surface**, **Night Popover**, and **Night Ink**:
  Green-black dark-theme counterparts for app, content, overlay, and text
  surfaces.

### Named Rules

**The One Hue Axis Rule.** Product chrome and charts stay on the 162.2° ledger
hue axis; category colors may break it because they carry user-owned semantic
data.

**The Theme Parity Rule.** Dark mode may alter lightness, contrast, and surface
depth, but it does not become a separate color identity.

## Typography

**Display Font:** Mona Sans (sans-serif fallback)
**Body Font:** Geist (sans-serif fallback)
**Label Font:** Geist (same family, compact weight and size)

**Character:** The pairing is restrained and contemporary. Mona Sans gives rare
large statements a composed shape; Geist keeps dense forms, navigation, tables,
and descriptions legible. The CSS imports Inter as a shipped variable font,
so environments without the named Geist or Mona Sans faces resolve through the
generic sans-serif fallback.

### Hierarchy

- **Display** (600, 1.875rem / 30px, 1.2): Rare high-value figures and top-level
  statements.
- **Headline** (600, 1.5rem / 24px, 1.25): Screen or major section headings.
- **Title** (500, 1rem / 16px, 1.25): Dialog, drawer, and grouped-section titles.
- **Body** (400, 0.875rem / 14px, 1.5): Controls, tables, descriptions, and form
  content.
- **Label** (500, 0.75rem / 12px, 1.4): Metadata, badges, field support, and
  secondary status text.

### Named Rules

**The Data Stays Numeric Rule.** Financial values use tabular figures and must
not rely on color or weight alone to convey meaning.

**The Two-Family Rule.** Mona Sans owns the larger heading scale; Geist owns
operational text. Do not add decorative display faces or fintech monospace
treatment.

## Layout

The application fills the viewport with `h-svh`. The desktop shell uses a 16rem
sidebar, a 3rem collapsed rail, and a flexible content inset. Route chrome is a
fixed 3rem header with 1.5rem horizontal padding; the scrolling content region
uses 1.5rem padding and a 1rem vertical gap.

The working rhythm is compact: controls are normally 2rem high, list rows use
0.75rem horizontal padding and 0.625rem vertical padding, and feature sections
separate by 1.5rem. Narrow windows keep the same hierarchy, wrap action groups,
and let data surfaces scroll horizontally rather than compressing content.
The `sm` breakpoint is 640px and `md` is 768px; drawers, footers, and field
groups change arrangement at those boundaries.

## Elevation & Depth

Zai uses layered restraint. Route content, tables, forms, empty states, and list
rows stay flat, using borders and tonal backgrounds to explain structure. Menus,
dialogs, drawers, and other temporary interaction layers may use the source
shadow scale and a low-contrast ring. Elevation communicates interaction state,
not decoration.

### Shadow Vocabulary

- **Hairline edge** (`0 1px 0 0 oklch(0.55 0.012 162.2 / 0.05)`): Minimal
  separation for tiny floating boundaries.
- **Control lift** (`0 1px 2px 0 oklch(0.55 0.012 162.2 / 0.05)`): Small
  floating controls when a boundary needs slight separation.
- **Overlay** (`0 4px 6px -1px oklch(0.55 0.012 162.2 / 0.1), 0 2px 4px -2px oklch(0.55 0.012 162.2 / 0.1)`):
  Popovers and menus.
- **Raised overlay** (`0 10px 15px -3px oklch(0.55 0.012 162.2 / 0.1), 0 4px 6px -4px oklch(0.55 0.012 162.2 / 0.1)`):
  Larger temporary layers.

### Named Rules

**The Work Surface Stays Flat Rule.** Do not add resting shadows to route
sections, tables, filters, empty states, or routine form groups.

**The Layer Must Earn Lift Rule.** A shadow means a surface is temporarily above
another surface; remove it when that interaction layer closes.

## Shapes

The root applies `corner-shape: squircle`. The base radius is 0.75rem (12px),
with 0.5rem and 0.625rem steps for compact controls and navigation. Dialogs,
drawers, and larger temporary layers use the 1rem step. Badges use a 2rem pill
radius; data containers and dashed empty/drop states may stay rectangular so
their borders express sequence and state.

Borders are normally one pixel and semantic. Use rounded corners at every
component boundary, with radii that feel natural to the component's size and
role. No sharp corners. Focus states add a ring without replacing the
structural border.

## Components

Components express soft utility with compact dimensions and understated state
feedback. Feature-owned category badges add color only where category identity
needs to be read quickly.

### Buttons

- **Shape:** 2rem high with a 0.75rem squircle; icon-sm controls use 1.75rem.
- **Primary:** Ledger Green fill, Ledger White text, 14px medium type, and
  0 0.625rem horizontal padding.
- **Hover / Focus:** Primary hover uses 80% opacity; focus adds the Ledger Green
  border and a 3px ring at 50% alpha; press translates down by 1px.
- **Outline / Ghost / Destructive:** Outline uses a hairline border and canvas
  fill; ghost reveals a muted surface on hover; destructive uses a tinted red
  surface with red text.

### Chips

- **Style:** 1.25rem-high pills with 12px medium type and 0.125rem 0.5rem
  padding.
- **State:** Ledger Green is reserved for primary status. Secondary, outline,
  ghost, and destructive variants carry supporting states.

### Cards / Containers

- **Corner Style:** Feature lists and empty states use natural 0.5rem–0.75rem
  squircles; dialogs and floating containers use 0.75rem–1rem squircles.
- **Background:** Canvas, popover, or muted tonal surfaces from the semantic
  theme.
- **Shadow Strategy:** Flat at rest; temporary layers use the Elevation scale.
- **Border:** One-pixel hairline or semantic destructive border.
- **Internal Padding:** 0.75rem for dense rows, 1rem for overlays, 1.5rem for
  route content, and 2.5rem vertical padding for tall empty/drop states.

### Inputs / Fields

- **Style:** 2rem high, transparent or input-tinted background, one-pixel input
  border, 0.75rem squircle, 14px text, and 0.625rem horizontal padding.
- **Focus:** Ledger Green ring with a 3px 50%-alpha treatment and border shift.
- **Error / Disabled:** Audit Red border and ring for invalid fields; disabled
  fields retain their labels while lowering opacity and using a muted fill.

### Navigation

The sidebar uses a sage-tinted canvas, 2rem rows, 14px text, 16px icons, and
0.375rem squircles. Hover and active states use the sidebar accent surface;
active items gain medium weight. The rail collapses to 3rem with tooltips, and
narrow screens use the sidebar sheet behavior.

### Data Lists

Category lists are the signature border-led work surface. Spending and Income
sections remain separate; root rows carry category badges and actions, child
rows are indented by 2.5rem, and expand/collapse is keyboard-operable. Row
actions reveal on hover or focus-within, while row hover uses a muted tonal fill.
The list uses 0.75rem rounded clipping at its outer boundary and no resting
shadow.

### Empty States

Empty and import states use semantic sections with dashed one-pixel borders,
centered copy, and explicit next actions. The category empty state uses a
minimum 18rem height, a short explanation, a primary `New category` action,
and an outlined `Import categories` fallback; the route header keeps file
actions available for the same local workflow.

## Do's and Don'ts

### Do:

- **Do** use Ledger Green as a quiet semantic anchor for primary action, focus,
  selection, and chart continuity.
- **Do** use rounded corners with natural radii on every component boundary; no
  sharp corners.
- **Do** keep routine controls at 32px and operational text at 14px or larger.
- **Do** organize working surfaces with borders, muted bands, whitespace, and
  clear semantic sections.
- **Do** preserve equal light/dark information hierarchy and accessible focus.
- **Do** let user-owned category colors carry meaning without recoloring product
  chrome.
- **Do** respect reduced motion for list expansion, drawers, and state changes.

### Don't:

- **Don't** introduce neon green, cyan glow, gradient text, or luminous fintech
  effects.
- **Don't** use sharp-cornered surfaces or arbitrary radius changes.
- **Don't** use shadow as resting decoration on a data surface.
- **Don't** make financial data smaller than 12px or encode meaning through
  color alone.
- **Don't** replace compact utility with oversized marketing typography inside
  the application.
- **Don't** use glyph icons or unlabelled icon-only controls; preserve the
  existing inline SVG and accessible-label pattern.
