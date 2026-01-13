---
description: "React Native development standards and best practices"
applyTo: "**/*.jsx, **/*.tsx, **/*.js, **/*.ts"
---

## Feature Structure

Follow `src/features/transaction-category/` pattern:

```
features/{name}/
  ├── types.ts          # Zod schemas + TypeScript types
  ├── commands.ts       # Tauri invoke wrappers with Zod validation
  ├── queries/          # TanStack Query hooks (useQuery)
  ├── mutations/        # TanStack Query mutations (useMutation)
  ├── stores/           # Zustand stores for UI state
  ├── components/       # Feature-specific components
  └── screens/          # Route components
```

## Code Conventions

- Use `function` keyword for pure functions
- Use Zod schemas for runtime validation of Tauri responses
- Prefer interfaces over types; avoid enums (use const maps)
- Use descriptive names: `isLoading`, `hasError`, `handleSubmit`
- TanStack Query for server state; Zustand for UI-only state
- Import from `@/` alias (maps to `src/`)

## UI Components

- Radix UI primitives in `src/components/ui/` (shadcn/ui style)
- Tailwind CSS for styling
- `lucide-react` for icons
- `sonner` for toast notifications

## State Management

Choose the right tool for each state type:

| State Type         | Tool            | Example                          |
| ------------------ | --------------- | -------------------------------- |
| Server/cached data | TanStack Query  | Transaction list, categories     |
| UI-only global     | Zustand         | Selected items, modal open state |
| Form state         | react-hook-form | Create/edit forms                |
| Component-local    | useState        | Dropdown open, input value       |

**Query Key Conventions:**

```typescript
// Entity list
["transactionCategories"][
  // Single entity
  ("transactionCategory", categoryId)
][
  // Filtered list
  ("transactions", { startDate, endDate })
][
  // Nested/related data
  ("transactionCategory", categoryId, "transactions")
];
```

## Frontend Query Pattern

See [queries/](src/features/transaction-category/queries/):

```typescript
export const useThing = (id: string) =>
  useQuery({ queryKey: ["thing", id], queryFn: () => getThing(id) });
```

## Route Creation

TanStack Router uses file-based routing in `src/routes/`:

```
src/routes/
  ├── __root.tsx           # Root layout with sidebar
  ├── index.tsx            # Home route (/)
  ├── transactions/
  │   ├── index.tsx        # /transactions
  │   └── categories/
  │       └── index.tsx    # /transactions/categories
```

**Create a new route:**

1. Add `src/routes/{name}/index.tsx`
2. Export a `Route` using `createFileRoute`:

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-route/")({
  component: MyRouteScreen,
});
```

3. Routes auto-generate in `src/routeTree.gen.ts` (run `pnpm generate-routes` or auto via dev server)

## Testing (TypeScript/React)

```typescript
// Test TanStack Query hooks with wrapper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

test("useTransactionCategories fetches data", async () => {
  const { result } = renderHook(() => useTransactionCategories(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});

// Mock Tauri invoke for frontend tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([{ id: "1", name: "Food" }]),
}));
```

## Tauri Plugin Usage (Frontend)

See `src/lib/adapters.ts`:

```typescript
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

// File picker example
const filePath = await open({
  filters: [{ name: "CSV", extensions: ["csv"] }],
});
const content = await readTextFile(filePath);
```

**Stronghold for secrets** (see `src/lib/stronghold.ts`):

```typescript
import { Stronghold } from "@tauri-apps/plugin-stronghold";

const stronghold = await Stronghold.load(path, password);
const store = stronghold.loadStore("store", password);
await store.insert("api_key", Array.from(new TextEncoder().encode(value)));
```

## Error Handling (Frontend)

Catch errors and display via `sonner`:

```typescript
onError() {
  toast.error("Failed to load transaction categories");
}
```

## Query Invalidation

After mutations, invalidate related queries:

```typescript
await queryClient.invalidateQueries({ queryKey: ["transactionCategories"] });
```
