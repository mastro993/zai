# Category Parent Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editable Parent category drawer selector with an anchored searchable combobox whose category options use `CategoryBadge`.

**Architecture:** Add a category-form-local `CategoryParentCombobox` that composes the existing Base UI `Combobox` wrappers. Keep `CategoryDrawerSelect` unchanged for transaction filters and multi-select flows. Keep `CategoryFormDrawer` responsible for React Hook Form state and the existing role/color transitions.

**Tech Stack:** React 19, TypeScript, Base UI 1.6, existing shadcn `Combobox`, React Hook Form, Tailwind CSS v4, Hugeicons, Vitest, Testing Library, pnpm.

## Global Constraints

- Keep `id="category-parent-trigger"`, accessible name `Parent category`, and `None` empty value.
- Keep root-only parent options and one-level nesting rules.
- Render selected and option categories with existing `CategoryBadge` and `getCategoryDisplayColor`.
- Preserve existing role/color reset and inheritance behavior.
- Close the popup when the parent drawer closes.
- Do not change `CategoryDrawerSelect`, backend code, schemas, routes, persistence, child-category locked display, or category-list UI.
- Use semantic shadcn tokens and existing Base UI composition; no new dependency.
- Preserve unrelated worktree changes and stage only task paths.

---

### Task 1: Specify parent combobox behavior with focused tests

**Files:**

- Modify: `apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx`

**Interfaces:**

- Consumes: existing `CategoryFormDrawer`, `Drawer`, `TransactionCategory` fixtures.
- Produces: regression coverage for the new `CategoryParentCombobox` contract.

- [ ] **Step 1: Add root-category fixtures**

Define a second root fixture, for example `salary`, beside `food`, so the test can prove filtering among multiple parent options. Keep fixtures synthetic and typed as `TransactionCategory`.

- [ ] **Step 2: Add failing interaction test**

Add a test that renders a create-root form with `[food, salary]`, then asserts the parent trigger is a combobox:

```tsx
const trigger = screen.getByRole("combobox", { name: "Parent category" });
expect(trigger.textContent).toContain("None");

fireEvent.click(trigger);

const search = screen.getByPlaceholderText("Search categories");
fireEvent.change(search, { target: { value: "food" } });

const foodOption = screen.getByRole("option", { name: "Food" });
expect(foodOption.querySelector('[data-slot="badge"]')).not.toBeNull();
expect(screen.queryByRole("option", { name: "Salary" })).toBeNull();

fireEvent.click(foodOption);
expect(trigger.textContent).toContain("Food");
expect(trigger.getAttribute("aria-expanded")).toBe("false");
expect(screen.queryByPlaceholderText("Search categories")).toBeNull();
```

Reopen the trigger, select the `None` option, and assert the root role combobox returns:

```tsx
fireEvent.click(trigger);
fireEvent.click(screen.getByRole("option", { name: "None" }));
expect(screen.getByRole("combobox", { name: "Category role" })).not.toBeNull();
```

This proves search, badge rendering, single selection, clear-to-root behavior, and popup dismissal. Keep the existing role submission test as coverage for final form submission.

- [ ] **Step 3: Run the focused test and verify it fails for the intended reason**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Expected: FAIL because the current parent selector exposes a button/drawer, not a combobox with a searchable option list.

---

### Task 2: Build the searchable category-parent combobox

**Files:**

- Create: `apps/frontend/src/features/categories/components/category-parent-combobox.tsx`

**Interfaces:**

- Consumes: `TransactionCategory`, `CategoryBadge`, `getCategoryDisplayColor`, and shared `Combobox` wrappers.
- Produces:

```ts
interface CategoryParentComboboxProps {
  id: string;
  categories: Array<TransactionCategory>;
  value: string | null;
  parentOpen: boolean;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
}
```

- [ ] **Step 1: Define option data and controlled popup state**

Use a sentinel option for clearing plus one option per root category:

```tsx
interface CategoryParentOption {
  kind: "none" | "category";
  value: string;
  label: string;
  category?: TransactionCategory;
}

const NONE_OPTION: CategoryParentOption = {
  kind: "none",
  value: "",
  label: "None",
};
```

Derive `items` from the `categories` prop, resolve the selected category by `value`, and store popup state with `useState(false)`. Close state when `parentOpen` becomes false. Configure Base UI with `itemToStringLabel`, `itemToStringValue`, `value`, `open`, `onOpenChange`, and `onValueChange`; map the sentinel to `null` and category options to their IDs.

- [ ] **Step 2: Render the trigger with selected category badge**

Compose `ComboboxTrigger` with the shared `Button` using `render`, keeping `id`, `type="button"`, `variant="outline"`, `aria-label="Parent category"`, and the compact full-width classes. Render `None` in muted text when no category is selected. Render the selected category through:

```tsx
<CategoryBadge color={getCategoryDisplayColor(selected.category)}>
  {selected.category.name}
</CategoryBadge>
```

Use `ComboboxValue` so Base UI owns the trigger value semantics. Do not use the old `DrawerTrigger` or drawer-specific props.

- [ ] **Step 3: Render searchable badge options**

Compose `ComboboxContent aria-label="Select parent category"`, `ComboboxInput` with `placeholder="Search categories"` and `showTrigger={false}`, then `ComboboxList`. Render `None` as a normal `ComboboxItem` and each category as a `ComboboxItem` containing `CategoryBadge` with its display color. Use the primitive’s built-in selected indicator; add only semantic selected/hover spacing needed for the category badge.

Let Base UI perform filtering through `itemToStringLabel`. Do not add a second query state or hand-rolled keyboard navigation. Include `ComboboxEmpty` with copy `No categories match.` for no search results.

- [ ] **Step 4: Run the focused test and fix only local failures**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Expected: the new parent-combobox test and existing category-form tests PASS. Resolve any Base UI type or Testing Library semantics issue inside the new component/test without modifying generic selector or shared primitive behavior.

---

### Task 3: Connect combobox to the category form

**Files:**

- Modify: `apps/frontend/src/features/categories/components/category-form-drawer.tsx:1-30,155-207`

**Interfaces:**

- Consumes: `CategoryParentCombobox` props from Task 2.
- Produces: the existing `Controller` parent field backed by the new combobox.

- [ ] **Step 1: Replace the editable parent selector**

Remove the `CategoryDrawerSelect` import from this file only. In the `Controller` for `parentId`, render:

```tsx
<CategoryParentCombobox
  id="category-parent-trigger"
  categories={rootOptions}
  value={field.value ? field.value : null}
  parentOpen={open}
  onBlur={field.onBlur}
  onChange={(nextParentId) => {
    field.onChange(nextParentId ?? "");

    if (nextParentId) {
      form.setValue("role", undefined, { shouldDirty: true, shouldValidate: true });
      form.setValue("color", undefined, { shouldDirty: true, shouldValidate: true });
      return;
    }

    const currentColor = form.getValues("color");
    if (!form.getValues("role")) {
      form.setValue("role", "spending", { shouldDirty: true, shouldValidate: true });
    }
    if (currentColor === undefined) {
      form.setValue("color", DEFAULT_CATEGORY_COLOR, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }}
/>
```

Keep the surrounding `Field`, label, helper text, root filtering, locked child branch, and all role/color business logic unchanged.

- [ ] **Step 2: Run focused category tests**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx src/features/categories/components/__tests__/category-drawer-select.test.tsx
```

Expected: both suites PASS, proving generic drawer-selector consumers remain unchanged.

---

### Task 4: Validate UI quality and finish

**Files:**

- Inspect only: changed source and test files plus the committed spec.

- [ ] **Step 1: Load craft-floor guidance before UI edits**

Read `.agents/skills/impeccable/reference/craft-floor.md` immediately before the first UI source edit. Apply its quality floor without changing the approved scope or design artifacts.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
pnpm --filter frontend check:frontend
git diff --check
```

Expected: frontend gate PASS and no whitespace errors. If the workspace exposes the focused test command through the frontend package script, rerun the category form and drawer-selector suites after the gate.

- [ ] **Step 3: Inspect final diff and status**

Run:

```bash
git diff --stat
git status --short
git diff -- apps/frontend/src/features/categories/components/category-parent-combobox.tsx apps/frontend/src/features/categories/components/category-form-drawer.tsx apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Confirm only the approved component, form wiring, and focused tests changed after the spec commit. Do not modify or stage unrelated files.

- [ ] **Step 4: Commit implementation**

```bash
git add apps/frontend/src/features/categories/components/category-parent-combobox.tsx apps/frontend/src/features/categories/components/category-form-drawer.tsx apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx
git commit -m "feat(categories): add searchable parent combobox"
```
