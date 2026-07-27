---
name: Zai
description: The Quiet Ledger — calm, private financial utility with soft geometry and exact data.
colors:
  ledger-green: "oklch(0.476 0.078 162.2)"
  ledger-white: "oklch(1 0 0)"
  ledger-ink: "oklch(0.25 0.023 162.2)"
  sage-mist: "oklch(0.97 0.002 162.2)"
  sage-wash: "oklch(0.955 0.008 162.2)"
  muted-ink: "oklch(0.52 0.016 162.2)"
  hairline: "oklch(0.925 0.004 162.2)"
  audit-red: "oklch(0.584 0.239 28.5)"
  night-canvas: "oklch(0.15 0.008 162.2)"
  night-surface: "oklch(0.17 0.008 162.2)"
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
    letterSpacing: "normal"
  body:
    fontFamily: '"Geist", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"Geist", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  pill: "2rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.ledger-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.ledger-white}"
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
    width: "24rem"
---

# Design System: Zai

## Overview

**Creative North Star: "The Quiet Ledger"**

Zai is a calm, private place to do consequential financial work. Its visual
system pairs compact desktop utility with softened squircle geometry, a
low-chroma ledger-green axis, and generous white or near-black canvases. The
interface feels quiet rather than sparse: information remains dense where the
task demands it, while color and elevation stay understated.

The system is neither neon fintech nor decorative glass. It communicates trust
through legible data, stable spatial patterns, precise borders, and restrained
state changes. Rounded Nova/Base UI primitives soften the tool without making it
toy-like; tables, drawers, filters, and confirmations remain unmistakably
operational.

**Key Characteristics:**

- Low-chroma Ledger Green carried through actions, charts, and tinted neutrals
- Geist body typography with Mona Sans reserved for the larger heading scale
- Compact 32px controls with gentle squircle corners
- Full-height desktop shell with a collapsible sidebar and fixed 48px route bar
- Dense, border-led data surfaces with tabular numbers and quiet hover states
- Layered overlays above flat work surfaces, with complete light/dark token parity

## Colors

The palette is a single green-tinted continuum: Ledger Green supplies identity,
while Ledger Ink, Sage Mist, and Hairline keep the working canvas quiet.

### Primary

- **Ledger Green** (`oklch(0.476 0.078 162.2)`): Primary actions, the Zai mark,
  focus treatment, selected controls, and the shared hue axis for charts.
- **Ledger White** (`oklch(1 0 0)`): Text on Ledger Green and the principal
  light-mode canvas.

### Secondary

- **Sage Wash** (`oklch(0.955 0.008 162.2)`): Secondary actions and restrained
  selected surfaces.
- **Sage Mist** (`oklch(0.97 0.002 162.2)`): Muted rows, hover states, table
  bands, and quiet grouping.

### Tertiary

- **Audit Red** (`oklch(0.584 0.239 28.5)`): Destructive actions, validation
  failures, and financial-state warnings. Prefer tinted backgrounds with
  Audit Red text over large solid fills.

### Neutral

- **Ledger Ink** (`oklch(0.25 0.023 162.2)`): Primary text in light mode; its
  subtle green cast keeps typography inside the same color world.
- **Muted Ink** (`oklch(0.52 0.016 162.2)`): Supporting copy, placeholders,
  timestamps, and inactive metadata.
- **Hairline** (`oklch(0.925 0.004 162.2)`): Borders, dividers, input strokes,
  and table structure.
- **Night Canvas** (`oklch(0.15 0.008 162.2)`), **Night Surface**
  (`oklch(0.17 0.008 162.2)`), and **Night Ink** (`oklch(0.98 0 0)`): The
  dark-mode foundation. Preserve the green cast rather than substituting a blue
  or neutral-black scheme.

### Named Rules

**The One Hue Axis Rule.** Product chrome and charts stay on the 162.2° ledger
hue axis; category colors and Audit Red may break it only when they carry real
semantic data.

**The No Neon Rule.** Never increase the accent into electric green, cyan, or a
glowing fintech gradient. Ledger Green is muted on purpose.

**The No Glass Rule.** Do not introduce frosted cards, glossy panes, or
translucent content surfaces. The current translucent select/menu treatment is
an implementation exception, not a system pattern to propagate.

## Typography

**Display Font:** Mona Sans (sans-serif fallback)
**Body Font:** Geist (sans-serif fallback)
**Label Font:** Geist (same family, weight and size provide hierarchy)

**Character:** The pairing is quiet and contemporary: Mona Sans gives large
financial summaries a composed voice, while Geist keeps dense controls and data
highly legible. The configured stylesheet currently imports Inter rather than
the named Geist and Mona Sans faces, so environments without those fonts use
the generic sans-serif fallback; treat the CSS font tokens as normative.

### Hierarchy

- **Display** (600, 1.875rem / 30px, 1.2): High-value financial figures and
  rare top-level statements.
- **Headline** (600, 1.5rem / 24px, 1.25): Screen or major section headings
  when breadcrumbs alone are insufficient.
- **Title** (500, 1rem / 16px, 1.25): Dialog, drawer, and grouped-section titles.
- **Body** (400, 0.875rem / 14px, 1.5): Default controls, tables, descriptions,
  and form content.
- **Label** (500, 0.75rem / 12px, 1.4): Table metadata, compact badges, field
  support, and secondary status text.

### Named Rules

**The Data Stays Numeric Rule.** Right-align financial amounts and use tabular
figures. Never rely on font weight or color alone to distinguish positive,
negative, pending, or failed values.

**The Two-Family Rule.** Mona Sans is for the larger heading scale; Geist owns
all operational text. Do not add a decorative display face or use monospace as
fintech decoration.

## Layout

The app occupies the full viewport (`h-svh`) and divides it into a collapsible
16rem sidebar, a 3rem icon rail when collapsed, and a flexible content inset.
Each route uses a fixed 3rem header with breadcrumbs and actions, followed by a
scrolling content region at `1.5rem` padding and a `1rem` vertical gap.

The working rhythm is compact: controls are normally 2rem high, table cells use
`0.75rem` padding, forms use `1rem` groups, and major route sections use
`1.5rem`. Tables keep their intrinsic density and scroll horizontally instead
of compressing financial data into illegibility. Filters and action groups wrap
before they collide.

At the `sm` breakpoint (640px), stacked footer actions become horizontal and
drawers or sheets adopt bounded widths. At `md` (768px), field layouts can move
from vertical to horizontal and form text settles at 14px. Narrow windows retain
the desktop information hierarchy but allow full-width sheets, wrapped actions,
and horizontally scrollable tables.

## Elevation & Depth

Zai uses **layered restraint**. Route content, tables, field groups, empty
states, and list rows remain flat, separated by Hairline borders and Sage Mist
tonal steps. Dialogs, menus, popovers, sheets, and drawers may rise above the
work surface using a fine ring, a low green-cast shadow, and short entrance
motion. Depth describes interaction hierarchy; it is never ambient decoration.

### Shadow Vocabulary

- **Edge** (`0 1px 2px 0 oklch(0.55 0.012 162.2 / 0.05)`): Small floating
  controls and barely lifted boundaries.
- **Overlay** (`0 4px 6px -1px oklch(0.55 0.012 162.2 / 0.1), 0 2px 4px -2px
  oklch(0.55 0.012 162.2 / 0.1)`): Popovers and menus.
- **Raised overlay** (`0 10px 15px -3px oklch(0.55 0.012 162.2 / 0.1), 0 4px
  6px -4px oklch(0.55 0.012 162.2 / 0.1)`): Sheets and other larger temporary
  layers.

### Named Rules

**The Work Surface Stays Flat Rule.** Never place resting shadows on tables,
filters, route sections, or routine form containers. Borders and tonal
separation are sufficient.

**The Layer Must Earn Lift Rule.** A shadow means the surface is temporarily
above another surface. Remove the shadow when that interaction layer closes.

## Shapes

The root applies `corner-shape: squircle`, and Nova primitives use a
`0.5rem` base radius. Buttons and inputs use the base 8px squircle, compact
controls step down to 4–6px, and dialogs or drawer edges step up to 12px. Pills
are reserved for badges and small categorical states.

Feature-owned data containers remain mostly rectangular because their borders
express grids, sequences, and selection regions. Dashed rectangles identify
empty or drop-like states. Do not round every nested container: soft geometry
belongs to interaction targets and floating layers, while data structure may
stay crisp.

## Components

Components express **soft utility with understated states**: gentle edges,
compact dimensions, and visible but quiet feedback.

### Buttons

- **Shape:** 8px squircle at the default 32px height; 4–6px for 24–28px compact
  variants.
- **Primary:** Ledger Green background, Ledger White text, 14px medium type,
  `0 0.625rem` horizontal padding.
- **Hover / Focus:** Hover moves to 80% Ledger Green. Focus uses a Ledger Green
  border and 3px 50%-alpha ring; press translates down by 1px.
- **Outline / Secondary / Ghost:** Outline uses Hairline on the canvas,
  Secondary uses Sage Wash, and Ghost is transparent until a Sage Mist hover.
  Destructive uses a 10% Audit Red fill rather than a solid red button.

### Chips

- **Style:** Default badges are 20px-high pills with 12px medium type and
  `0.125rem 0.5rem` padding.
- **State:** Ledger Green is reserved for primary status; Sage Wash, outline,
  ghost, and Audit Red tints handle supporting or destructive states. Feature
  metadata may square a badge only when it sits inside a compact data snapshot.

### Cards / Containers

- **Corner Style:** There is no generic card wrapper in the current component
  set. Feature containers are usually rectangular; floating containers use
  8–12px squircles.
- **Background:** Ledger White or Night Surface, with Sage Mist for subordinate
  bands.
- **Shadow Strategy:** None for resting content; see Layered Restraint.
- **Border:** 1px Hairline.
- **Internal Padding:** 12px for dense summaries, 16px for overlays, 24px for
  route-level empty states.

### Inputs / Fields

- **Style:** 32px high, transparent canvas, 1px Hairline stroke, 8px squircle,
  14px text, and `0.625rem` horizontal padding.
- **Focus:** Ledger Green border plus a 3px 50%-alpha ring.
- **Error / Disabled:** Audit Red border and ring for invalid input; disabled
  fields use a 50% input fill and 50% opacity without removing their label.

### Navigation

The sidebar uses the Sage-tinted sidebar canvas and 32px menu rows with 14px
text, 16px Hugeicons at stroke width 2, and 6px squircles. Hover and active
states use the sidebar accent fill; active items gain medium weight rather than
an extra color stripe. The rail collapses to 3rem with tooltips, while narrow
screens use the sheet behavior provided by the sidebar primitive.

### Data Tables

Tables are the signature work surface. Use a 1px enclosing border, a
`bg-muted/40` header band, 12px cell padding, 14px body type, quiet
`bg-muted/50` row hover, and right-aligned tabular amounts. Preserve horizontal
scroll, sticky headers or actions where already established, and full-row
selection feedback without turning rows into individual cards.

### Dialogs, Drawers, and Popovers

Dialogs use a 12px squircle, 16px padding, a 1px low-contrast ring, and a muted
footer band. Drawers use a rounded leading edge and a 450ms decelerating
gesture-aware transition. Popovers and menus use the 8px squircle and the
Overlay shadow. Keep overlay copy at 14px, titles at 16px medium, and reserve
backdrop blur for the minimal inherited overlay treatment—not a glass aesthetic.

## Do's and Don'ts

### Do:

- **Do** use Ledger Green as a quiet semantic anchor for primary action, focus,
  and data continuity.
- **Do** keep routine controls at 32px and default operational text at 14px.
- **Do** use borders, muted bands, and whitespace to organize tables and forms.
- **Do** reserve shadows for temporary interaction layers.
- **Do** preserve equal information hierarchy and token parity in dark mode.
- **Do** let feature-owned category colors carry meaning without recoloring the
  surrounding product chrome.

### Don't:

- **Don't** introduce neon green, cyan glows, gradient text, or luminous fintech
  effects.
- **Don't** propagate glassmorphism, frosted cards, glossy panels, or translucent
  content surfaces.
- **Don't** wrap every route section or table in a rounded card.
- **Don't** use a shadow on a resting data surface.
- **Don't** make financial data smaller than 12px or encode meaning through
  color alone.
- **Don't** replace compact utility with oversized marketing typography inside
  the application shell.
