---
name: Zai
description: Confident minimal personal finance — local, precise, numbers-first.
colors:
  growth-green: "oklch(0.527 0.154 150.069)"
  growth-green-foreground: "oklch(0.982 0.018 155.826)"
  growth-green-dark: "oklch(0.448 0.119 151.328)"
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  surface: "oklch(1 0 0)"
  surface-muted: "oklch(0.97 0 0)"
  ink-muted: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  sidebar: "oklch(0.985 0 0)"
typography:
  display:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  none: "0"
  base: "0.625rem"
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.growth-green}"
    textColor: "{colors.growth-green-foreground}"
    rounded: "{rounded.none}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "{colors.growth-green}"
    textColor: "{colors.growth-green-foreground}"
    rounded: "{rounded.none}"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 0.625rem"
    height: "2rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  badge-default:
    backgroundColor: "{colors.growth-green}"
    textColor: "{colors.growth-green-foreground}"
    rounded: "{rounded.none}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
---

# Design System: Zai

## 1. Overview

**Creative North Star: "The Workbench"**

Zai reads like a personal finance workbench on a desktop: squared edges, tight type, neutral surfaces, and one Growth Green accent that marks action and brand — never decoration. Data tables, sidebar navigation, and form drawers carry the product; there is no marketing chrome inside the shell. Density follows Copilot Money and Linear: small controls (`text-xs`, 32px row height), clear hierarchy, and borders that structure space instead of shadows.

The system explicitly rejects generic SaaS dashboards (card grids, gradient heroes, eyebrow kickers, hero-metric templates), decorative glass, and fintech neon. Motion stays functional; elevation stays flat.

**Key Characteristics:**

- Single sans family (Inter Variable) at compact sizes
- Squared interactive controls (`rounded-none`) on Lyra/shadcn primitives
- Growth Green accent on ≤10% of any screen
- Depth via 1px borders and tonal steps, not drop shadows
- Sidebar app shell with icon-collapsible rail
- Dark mode parity on all semantic tokens

## 2. Colors

A restrained neutral canvas with one green accent tuned for clarity, not corporate banking.

### Primary

- **Growth Green** (oklch(0.527 0.154 150.069)): Primary actions, brand mark (財 / Zai), active nav emphasis, positive semantic emphasis. Dark mode: oklch(0.448 0.119 151.328).
- **Growth Green Foreground** (oklch(0.982 0.018 155.826)): Text on primary-filled surfaces.

### Secondary

- **Cool Secondary** (oklch(0.967 0.001 286.375)): Secondary buttons and subdued fills. Slight cool tint separates from warm green without a second accent.

### Neutral

- **Canvas** (oklch(1 0 0)): Page background (light).
- **Ink** (oklch(0.145 0 0)): Primary text.
- **Surface Muted** (oklch(0.97 0 0)): Table headers, hover fills, subtle bands.
- **Ink Muted** (oklch(0.556 0 0)): Secondary text, placeholders — verify ≥4.5:1 on Canvas; bump toward Ink if borderline.
- **Border** (oklch(0.922 0 0)): 1px dividers, input strokes, table outlines.
- **Sidebar** (oklch(0.985 0 0)): App rail background, slightly off Canvas.

### Tertiary

- **Destructive** (oklch(0.577 0.245 27.325)): Errors, delete confirmations. Often at 10% fill with full hue text, not solid fills.

### Named Rules

**The One Accent Rule.** Growth Green appears on primary CTAs, brand, and key active states only. If green is everywhere, it stops meaning "go."

**The True Neutral Rule.** Body background stays achromatic (chroma 0). Warmth lives in the accent and category color dots, not cream-tinted page bg.

## 3. Typography

**Display Font:** Inter Variable (sans-serif fallback)
**Body Font:** Inter Variable (sans-serif fallback)
**Label Font:** Inter Variable (same family, weight/size differentiation)

**Character:** Technical-humanist sans at compact scale — readable at 12–14px, medium weight for headings, no second display face.

### Hierarchy

- **Display** (500, 1.5rem / 24px, 1.25): Screen titles (`h1` on route pages).
- **Title** (500, 1.125rem / 18px, 1.35): Section headers, drawer titles.
- **Body** (400, 0.875rem / 14px, 1.5): Default UI copy, table cells; cap prose at 65–75ch where long text appears.
- **Label** (500, 0.75rem / 12px, 1.4): Buttons, inputs, badges, table headers — default control size.

### Named Rules

**The Compact Default Rule.** Interactive UI defaults to `text-xs` (12px). Scale up for page titles only; never shrink below 12px for readable data.

## 4. Elevation

Flat-by-default. Depth is communicated with borders (`border-border`), background steps (`bg-muted/40` on table headers), and sidebar/content separation — not ambient shadows. Overlays (dialog, sheet, drawer, popover) may use subtle shadow from shadcn primitives; data surfaces stay flat.

### Shadow Vocabulary

- **Overlay lift** (shadcn default on sheets/dialogs): Reserved for modal layers above the workbench. Tables and cards do not carry resting shadows.

### Named Rules

**The Flat Table Rule.** Transaction and category tables use border + muted header band. No card wrapper around tables unless the section truly needs grouping.

## 5. Components

Tool-first primitives from shadcn (base-lyra) + Base UI. Squared corners on buttons, inputs, badges.

### Buttons

- **Shape:** Square corners (`rounded-none`, 0px radius on controls)
- **Primary:** Growth Green fill, Growth Green Foreground text, h-8 (32px), px-2.5, text-xs font-medium
- **Hover / Focus:** Primary at 80% opacity; `ring-1 ring-ring/50` on focus-visible; 1px active translate
- **Outline:** Border-border, canvas bg, muted hover
- **Ghost / Destructive:** Muted hover; destructive uses 10% fill + destructive text

### Chips

- **Badge default:** Growth Green fill, h-5, px-2, text-xs, squared
- **Outline / secondary:** Border or secondary fill for category/status tags

### Cards / Containers

- **Corner Style:** Base radius token (0.625rem) available but many surfaces are border-defined rectangles
- **Background:** Canvas or surface-muted bands
- **Shadow Strategy:** None at rest (see Elevation)
- **Border:** 1px border-border on tables and grouped sections
- **Internal Padding:** p-3 on table cells; p-6 on route sections

### Inputs / Fields

- **Style:** 1px border-input, transparent bg, h-8, rounded-none, text-xs
- **Focus:** border-ring + ring-1 ring-ring/50
- **Error:** border-destructive + destructive ring tint
- **Placeholder:** text-muted-foreground — verify contrast

### Navigation

- **Sidebar:** 16rem expanded / 3rem icon rail; Sidebar bg, ink text, Growth Green on brand + active items
- **Items:** text-sm in nav labels; Hugeicons stroke 2; tooltips when collapsed
- **Mobile:** Sheet overlay for sidebar

### Data Table (signature)

- **Header:** bg-muted/40, font-medium, text-xs, border-b
- **Rows:** text-sm body, right-align amounts, sticky actions column on wide tables
- **Category:** Color dot + name inline

## 6. Do's and Don'ts

### Do:

- **Do** lead screens with the number or table the user came for.
- **Do** use Growth Green sparingly for primary actions and brand.
- **Do** keep controls at 32px height and 12px type unless the element is a page title.
- **Do** use borders and muted bands to separate regions.
- **Do** support dark mode with the paired `.dark` token set.
- **Do** respect `prefers-reduced-motion` for non-essential transitions.

### Don't:

- **Don't** use generic SaaS dashboards: identical card grids, gradient heroes, eyebrow kickers, hero-metric templates.
- **Don't** add decorative motion, glass chrome, or marketing-page patterns inside the app shell.
- **Don't** use border-left/right >1px colored stripes on rows, alerts, or cards.
- **Don't** tint the page background warm cream/sand — stay achromatic neutral.
- **Don't** wrap every section in nested cards.
- **Don't** use gradient text or neon chart colors as default semantics.
