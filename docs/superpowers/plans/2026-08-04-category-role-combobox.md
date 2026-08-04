# Category Role Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editable category Role drawer selector with a compact, accessible shadcn Base UI combobox whose two options show icons and concise descriptions.

**Architecture:** Add the project-configured shadcn `Combobox` wrapper without applying its unrelated `input-group.tsx` update. Encapsulate the role-specific rich option rendering in a feature component, then connect it to the existing React Hook Form `Controller`; leave the parent-category drawer and child inherited-role display unchanged.

**Tech Stack:** React 19, TypeScript, React Hook Form, shadcn base-nova components, Base UI 1.6, Tailwind CSS v4, Hugeicons, Vitest, Testing Library, pnpm.

## Global Constraints

- Keep `CATEGORY_ROLE_OPTIONS` as the single source of truth for role values, labels, icons, and descriptions.
- Keep the existing `category-role` id and `Category role` accessible name.
- Use no search input because both fixed role options are visible at once.
- Preserve root-role schema semantics, React Hook Form validation, `onBlur`, and submit behavior.
- Do not generalize or change the parent-category `CategoryDrawerSelect` flow.
- Keep child categories’ read-only inherited-role field unchanged.
- Add only `combobox.tsx` from the shadcn CLI output; do not overwrite the existing `input-group.tsx`.
- Do not modify backend commands, schemas, routes, persistence, or generated route files.
- Preserve unrelated work and stage only task paths in each commit.

---

## File Map

- Create `apps/frontend/src/components/ui/combobox.tsx`: the project-configured shadcn Base UI combobox wrappers and semantic styles.
- Create `apps/frontend/src/features/categories/components/category-role-combobox.tsx`: controlled role combobox with the existing role option data, rich item rendering, parent-drawer close handling, and form callbacks.
- Modify `apps/frontend/src/features/categories/components/category-role-options.ts`: move the option shape off the shared generic selector and keep the role option data feature-owned.
- Modify `apps/frontend/src/features/categories/components/category-form-drawer.tsx`: replace the editable `DrawerSelect` usage and remove its now-unused imports.
- Modify `apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx`: cover the combobox trigger, rich options, selection, popup close, and submitted role.

## Task 1: Add the shadcn Combobox primitive

**Files:**

- Create: `apps/frontend/src/components/ui/combobox.tsx`
- Preserve: `apps/frontend/src/components/ui/input-group.tsx`

**Interfaces:**

- Produces `Combobox`, `ComboboxTrigger`, `ComboboxValue`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, and the other standard exports consumed by the role component.
- Consumes the existing `@base-ui/react`, `Button`, `InputGroup`, `InputGroupInput`, `InputGroupAddon`, `InputGroupButton`, Hugeicons, and `cn()` utilities.

- [ ] **Step 1: Confirm the exact registry source and overwrite boundary**

Run:

```bash
XDG_CACHE_HOME=/private/tmp/zai-xdg-cache pnpm dlx shadcn@latest add combobox --view src/components/ui/combobox.tsx -c apps/frontend
XDG_CACHE_HOME=/private/tmp/zai-xdg-cache pnpm dlx shadcn@latest add combobox --diff src/components/ui/input-group.tsx -c apps/frontend
```

Expected: the first command prints the Base UI + Hugeicons combobox source; the second shows only the unrelated removal of the existing `"use client"` line. Do not apply that `input-group.tsx` diff.

- [ ] **Step 2: Add only the generated combobox wrapper**

Copy the registry source into `apps/frontend/src/components/ui/combobox.tsx` with `apply_patch`. Keep the standard wrapper exports and styles, including:

```tsx
const Combobox = ComboboxPrimitive.Root

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="pointer-events-none size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}
```

Do not alter `input-group.tsx`, `package.json`, `pnpm-lock.yaml`, or any generated route file.

- [ ] **Step 3: Run the primitive-level type check**

Run:

```bash
pnpm --filter frontend type-check
```

Expected: PASS. If the generated wrapper exposes an unused import or a Base UI type mismatch, fix only `combobox.tsx` while keeping the registry API and the global constraints intact.

- [ ] **Step 4: Commit the primitive**

```bash
git add apps/frontend/src/components/ui/combobox.tsx
git commit -m "feat(frontend): add shadcn combobox primitive"
```

## Task 2: Write the failing category-form test

**Files:**

- Modify: `apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx`

**Interfaces:**

- Consumes the existing `CategoryFormDrawer` and `Drawer` test harness.
- Produces a regression test that the implementation in Task 3 must satisfy.

- [ ] **Step 1: Add the rich-role interaction test**

Add this test to the existing `describe("CategoryFormDrawer", ...)` block:

```tsx
it("uses a rich combobox for the root category role", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <Drawer open swipeDirection="right">
      <CategoryFormDrawer
        open
        mode={{ type: "create-root" }}
        categories={[]}
        onSubmit={onSubmit}
      />
    </Drawer>,
  );

  const trigger = screen.getByRole("combobox", { name: "Category role" });
  expect(trigger.textContent).toContain("Spending");

  fireEvent.click(trigger);

  const spending = screen.getByRole("option", { name: /Spending/ });
  const income = screen.getByRole("option", { name: /Income/ });
  expect(spending.textContent).toContain("Tracks outflows and can include refunds.");
  expect(income.textContent).toContain("Identifies genuine income only.");
  expect(spending.querySelector('[data-slot="category-role-icon"]')).not.toBeNull();
  expect(income.querySelector('[data-slot="category-role-icon"]')).not.toBeNull();

  fireEvent.click(income);
  expect(trigger.textContent).toContain("Income");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("option", { name: /Income/ })).toBeNull();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Salary" } });
  fireEvent.click(screen.getByRole("button", { name: "Save category" }));

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: "income" })),
  );
});
```

The icon assertion intentionally checks the decorative icon wrapper rather than depending on a specific SVG implementation.

- [ ] **Step 2: Run only the changed test to verify it fails**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Expected: FAIL because the current `DrawerSelect` trigger is not a `combobox` and the options are not rendered in a shadcn combobox popup.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx
git commit -m "test(categories): specify role combobox behavior"
```

## Task 3: Implement the controlled role combobox

**Files:**

- Create: `apps/frontend/src/features/categories/components/category-role-combobox.tsx`
- Modify: `apps/frontend/src/features/categories/components/category-role-options.ts`
- Modify: `apps/frontend/src/features/categories/components/category-form-drawer.tsx:1-30,230-256`

**Interfaces:**

- `CategoryRoleComboboxProps`:

```ts
interface CategoryRoleComboboxProps {
  id: string;
  value: CategoryRole | undefined;
  parentOpen: boolean;
  invalid?: boolean;
  onChange: (value: CategoryRole) => void;
  onBlur?: () => void;
}
```

- `CategoryRoleCombobox` consumes `CATEGORY_ROLE_OPTIONS` and produces a compact trigger plus an anchored rich option list.
- `CategoryFormDrawer` passes `field.value`, `open`, `Boolean(errors.role)`, `field.onChange`, and `field.onBlur` through the `Controller`.

- [ ] **Step 1: Create the role-specific component shell and close behavior**

Use `useState(false)` for the combobox popup and close it when `parentOpen` becomes false:

```tsx
const [open, setOpen] = useState(false);

useEffect(() => {
  if (!parentOpen) setOpen(false);
}, [parentOpen]);
```

Resolve the selected option from `CATEGORY_ROLE_OPTIONS` by `value`. Configure the root with object values and stable string conversion:

```tsx
<Combobox
  items={CATEGORY_ROLE_OPTIONS}
  value={selected ?? null}
  open={open}
  itemToStringLabel={(option) => option.label}
  itemToStringValue={(option) => option.value}
  onOpenChange={(nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) onBlur?.();
  }}
  onValueChange={(nextOption) => {
    if (nextOption) onChange(nextOption.value);
  }}
>
  {/* trigger and popup */}
</Combobox>
```

Do not add a `ComboboxInput`; the two role choices are always shown and are not searchable.

The option type must no longer come from `DrawerSelect`. In
`category-role-options.ts`, define and export the feature-owned option shape
using the existing Hugeicons type, then type `CATEGORY_ROLE_OPTIONS` with it:

```ts
export interface CategoryRoleOption {
  value: CategoryRole;
  label: string;
  description: string;
  icon: typeof ShoppingBag01Icon | typeof MoneyReceive01Icon;
}

export const CATEGORY_ROLE_OPTIONS: Array<CategoryRoleOption> = CATEGORY_ROLES.map(
  (role) => ({
    value: role,
    label: getCategoryRoleLabel(role),
    description: CATEGORY_ROLE_DESCRIPTIONS[role],
    icon: CATEGORY_ROLE_ICONS[role],
  }),
);
```

Preserve the existing option values, labels, descriptions, icon mapping, and order.

- [ ] **Step 2: Render the selected trigger**

Use the Base UI `render` prop with the existing shadcn `Button`, keeping the field contract and compact form rhythm:

```tsx
  <ComboboxTrigger
  render={
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-label="Category role"
      aria-invalid={invalid || undefined}
      className="h-8 w-full min-w-0 justify-between gap-2 overflow-hidden px-2.5 font-normal"
    />
  }
>
  <ComboboxValue>
    {selected ? (
      <span className="flex min-w-0 items-center gap-2">
        <HugeiconsIcon icon={selected.icon} data-icon="inline-start" aria-hidden="true" />
        <span className="truncate">{selected.label}</span>
      </span>
    ) : (
      <span className="truncate text-muted-foreground">Select a role</span>
    )}
  </ComboboxValue>
</ComboboxTrigger>
```

- [ ] **Step 3: Render rich option items**

Place the options inside `ComboboxContent` → `ComboboxList`, and render every option’s icon, label, description, and the wrapper-provided selected indicator:

```tsx
<ComboboxContent>
  <ComboboxList>
    {(option) => (
      <ComboboxItem
        key={option.value}
        value={option}
        className="items-start gap-3 py-2.5 pl-2"
      >
        <span
          data-slot="category-role-icon"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
          aria-hidden="true"
        >
          <HugeiconsIcon icon={option.icon} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{option.label}</span>
          <span className="block text-xs leading-4 text-pretty text-muted-foreground">
            {option.description}
          </span>
        </span>
      </ComboboxItem>
    )}
  </ComboboxList>
</ComboboxContent>
```

Use semantic tokens only. Keep the icon decorative because the option’s accessible name comes from its text.

- [ ] **Step 4: Switch the form over without changing form semantics**

In `category-form-drawer.tsx`:

```tsx
<CategoryRoleCombobox
  id="category-role"
  value={field.value}
  parentOpen={open}
  invalid={Boolean(errors.role)}
  onChange={field.onChange}
  onBlur={field.onBlur}
/>
```

Remove the now-unused `DrawerSelect`, `CategoryRole`, and `CATEGORY_ROLE_OPTIONS` imports. Keep the existing `Field`, label, description, and `FieldError` wrappers intact.

- [ ] **Step 5: Run the focused category test**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Expected: PASS, including the new rich combobox test and the existing color/inherited-role tests.

- [ ] **Step 6: Commit the implementation**

```bash
git add apps/frontend/src/components/ui/combobox.tsx apps/frontend/src/features/categories/components/category-role-combobox.tsx apps/frontend/src/features/categories/components/category-form-drawer.tsx apps/frontend/src/features/categories/components/__tests__/category-form-drawer.test.tsx
git commit -m "feat(categories): use combobox for category role"
```

## Task 4: Confirm selector ownership and verify the full focused scope

**Files:**

- Preserve: `apps/frontend/src/components/drawer-select.tsx`
- Preserve: `apps/frontend/src/components/__tests__/drawer-select.test.tsx`

**Interfaces:**

- The category role form no longer imports `DrawerSelect`; unrelated production consumers remain supported.
- The role combobox remains feature-owned; category parent selection continues to use `CategoryDrawerSelect`.

- [ ] **Step 1: Confirm remaining consumers and preserve shared selector**

Run:

```bash
rg -n "DrawerSelect|drawer-select" apps/frontend/src --glob '!routeTree.gen.ts'
```

Expected: the budget form may continue to report `DrawerSelect`; preserve the shared selector and its tests when that consumer exists. Confirm that the category form only uses `CategoryRoleCombobox` for the editable role field.

- [ ] **Step 2: Run focused category/component tests**

Run:

```bash
pnpm --filter frontend test -- src/features/categories/components/__tests__/category-form-drawer.test.tsx
```

Expected: PASS, including the new role combobox behavior and the existing category form coverage.

- [ ] **Step 3: Run frontend formatting, lint, and type checks**

Run:

```bash
pnpm --filter frontend format:check
pnpm --filter frontend lint
pnpm --filter frontend type-check
```

Expected: PASS with no generated route diff.

- [ ] **Step 4: Run the frontend gate and diff checks**

Run:

```bash
pnpm check:frontend
git diff --check
git status --short
git diff --stat
```

Expected: the frontend gate passes or reports only a pre-existing unrelated failure; `git diff --check` passes; the diff contains the approved spec/plan plus only the combobox primitive, role component, form/test migration, and preservation of unrelated selector consumers.
