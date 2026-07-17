---
target: budget form
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-07-17T07-25-07Z
slug: atures-cash-flow-components-budget-form-drawer-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Submit busy + toast + field/server errors; no draft/dirty affordance |
| 2 | Match System / Real World | 2 | "Net flow", "Previous", "Cumulative" abbreviated; full sense only in title/hover |
| 3 | User Control and Freedom | 3 | Cancel + nested Back + Clear; no undo after create/update |
| 4 | Consistency and Standards | 3 | Field/ToggleGroup/Drawer match shell; nested drawer stacks two drawers |
| 5 | Error Prevention | 3 | Zod + locked cadence on edit; empty category scope = all is silent footgun |
| 6 | Recognition Rather Than Recall | 2 | Toggle short labels; warning enable checkbox has no visible text label |
| 7 | Flexibility and Efficiency | 2 | Category search good; no accelerators; long single-scroll form |
| 8 | Aesthetic and Minimalist Design | 3 | Clean FieldSets, workbench density; description noise under every field |
| 9 | Error Recovery | 3 | Inline + root.server + revisionConflict copy; form preserved |
| 10 | Help and Documentation | 2 | FieldDescriptions exist; rollover/measurement lack task-level explainer |
| **Total** | | **26/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Not SaaS-slop. Squared controls, FieldSets, Growth Green primary, no cards/eyebrows/hero-metrics. Product-slop risk is different: expert jargon compressed into toggle chips that look finished but teach poorly. Feels Linear-adjacent structure with Copilot Money density — trustworthy skeleton, muddy rule vocabulary.

**Deterministic scan**: `detect.mjs` exit 0, `[]` findings across form drawer, scope field, selection drawer, budget screen. No AI-slop detector hits.

**Visual overlays**: Skipped — no frontend/Tauri dev server on :1420/:5173; no mutable browser injection this run.

## Overall Impression

Solid create/edit drawer for a power-user finance tool. Structure (Basics → Rules → Category scope) is right. Biggest gap: advanced budget semantics (measurement, rollover, empty=all categories) dumped at equal visual weight with name/allowance — first-timers guess; power users re-read titles. Opportunity: progressive disclosure + plain labels so allowance stays the number that leads.

## What's Working

1. **Chunked FieldSets** — Basics / Budget rules / Category scope with separators; scannable, not a wall of inputs.
2. **A11y wiring** — `aria-invalid`, describedby error ids, `aria-busy` submit, selection `aria-live`, expand labels, `motion-reduce` on chevron.
3. **Edit honesty** — Cadence disabled with "fixed after creation"; revisionConflict message is plain and actionable.

## Priority Issues

### [P1] Abbreviated rule toggles hide meaning
- **What**: Measurement shows "Net flow"; Rollover shows "Previous" / "Cumulative"; full copy only in `title` (`budgetMeasurementLabel` / `budgetRolloverOptionLabel`).
- **Why**: Hover-dependent labels fail keyboard/touch and first-timers. Domain words need on-surface clarity.
- **Fix**: Use full option labels (or two-line: short + description under group). Drop reliance on `title`.
- **Suggested command**: `/impeccable clarify`

### [P1] Empty category scope = all transactions, silent default
- **What**: Trigger shows "All categories" when `categoryIds` empty; description says empty includes all, but selection drawer also says "Only selected categories count."
- **Why**: Easy to create budget that tracks everything without noticing. High-stakes money config.
- **Fix**: Explicit "All categories" vs "Selected only" control; or require confirm when empty on submit.
- **Suggested command**: `/impeccable harden`

### [P1] No progressive disclosure for Budget rules
- **What**: Measurement + Rollover + Warning always visible at create; equal weight to Name/Allowance.
- **Why**: Cognitive load spike at open; violates numbers-first (allowance should dominate).
- **Fix**: Defaults (spending / off / 80%) collapsed under "Advanced rules" or secondary step; lead with name + allowance + cadence + categories.
- **Suggested command**: `/impeccable distill`

### [P2] Warning enable checkbox has no visible label
- **What**: Checkbox `aria-label="Enable warning"` beside % input; sighted users get unlabeled box.
- **Why**: Recognition fail; Sam OK via SR, everyone else guesses.
- **Fix**: Visible "Enable" / bind label to field, or use switch with text.
- **Suggested command**: `/impeccable clarify`

### [P2] Nested drawers for category pick
- **What**: Form drawer → category selection drawer; context of allowance/rules leaves viewport.
- **Why**: Working-memory tax; fine for desktop but stacks escape paths.
- **Fix**: Keep summary stronger on return (count + names); optional inline multi-select for small category sets.
- **Suggested command**: `/impeccable layout`

## Persona Red Flags

**Alex (Power User)**: Long scroll for one create; no Cmd/Ctrl+Enter documented; nested drawer for categories adds clicks. Defaults good (month/spending/off/80%) but advanced still in face.

**Jordan (First-Timer)**: "Net flow" / "Previous" / "Cumulative" opaque. Empty → "All categories" easy misread. Description on create ("rules, and which categories count") doesn't teach what rollover does.

**Sam (A11y)**: Strong landmarks and error wiring. Gaps: unlabeled warning checkbox visually; toggle short text may be all SR announces if titles ignored; nested drawers need clear focus move (Back labeled — good).

**Project — Desk tracker (from PRODUCT.md)**: Came for trusted numbers; form is config-first, no live "€1000 / month" preview of what they're defining. Missed numbers-first moment.

## Cognitive Load

Failed checklist: single focus, one-thing-at-a-time, minimal choices at open, progressive disclosure, working memory (nested drawer). ~5 failures → **high**.
Overloaded decision point: create form open shows Name + Allowance + Cadence(4) + Measurement(2) + Rollover(3) + Warning + Categories simultaneously.

## Emotional Journey

Open: calm title/description. Mid: rules jargon valley. End: Create/Save + toast — solid peak if submit succeeds. High-stakes empty=all and rollover undersell risk — little reassurance before commit.

## Minor Observations

- EUR hardcoded in addon — fine if app is EUR-only; else settings currency.
- Cadence labels Day/Week/Month/Year vs list labels "Monday-based week" elsewhere — mild inconsistency.
- Category footer "All categories" when count 0 reinforces empty=all (good if intentional, dangerous if not).
- Primary + Cancel footer order correct for drawer pattern.

## Questions to Consider

- What if allowance + cadence were the only required visible fields, rules behind one disclosure?
- Should "all categories" ever be implicit, or always an explicit choice?
- Would full rollover labels ("Previous period only") fit the 384px drawer without chip-cramp?
- Does create need a one-line preview: "€1,000 · Monthly · Spending · No rollover"?
