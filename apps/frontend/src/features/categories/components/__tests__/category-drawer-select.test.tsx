// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { categorySchema } from "../../types/model";
import { CategoryDrawerSelect } from "../category-drawer-select";

const food = categorySchema.parse({
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
  color: "#C32828",
});

const groceries = categorySchema.parse({
  id: "groceries",
  parentId: "food",
  name: "Groceries",
  role: "spending",
  parent: food,
  color: "#C32828",
});

const categories = [food, groceries];

async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const categoriesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/categories",
    component: () => <div>Categories</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, categoriesRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("CategoryDrawerSelect", () => {
  afterEach(() => cleanup());

  it("commits multi selection only on Done", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
      <CategoryDrawerSelect
        id="cats"
        mode="multiple"
        categories={categories}
        value={[]}
        onChange={onChange}
        placeholder="All categories"
        ariaLabel="Choose categories"
        drawerTitle="Select categories"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith(["food"]);
  });

  it("discards multi draft on Back", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
      <CategoryDrawerSelect
        id="cats"
        mode="multiple"
        categories={categories}
        value={[]}
        onChange={onChange}
        placeholder="All categories"
        ariaLabel="Choose categories"
        drawerTitle="Select categories"
        backAriaLabel="Back"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose categories" }).textContent).toContain(
      "All categories",
    );
  });

  it("commits single selection immediately", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={categories}
        value={null}
        onChange={onChange}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
        clearable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Food" }));
    fireEvent.click(screen.getByRole("option", { name: "Groceries" }));
    expect(onChange).toHaveBeenCalledWith("groceries");
  });

  it("uses a rounded content-sized category list", async () => {
    await renderWithRouter(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={[food]}
        value={null}
        onChange={vi.fn()}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));

    const list = screen.getByRole("listbox", { name: "Select category" });

    expect(list.classList.contains("rounded-lg")).toBe(true);
    expect(list.classList.contains("flex-1")).toBe(false);
  });

  it("renders the optional empty-state action as a categories link", async () => {
    await renderWithRouter(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={[]}
        value={null}
        onChange={vi.fn()}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
        emptyListMessage="No categories yet."
        emptyListActionLabel="Manage categories"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));

    const action = screen.getByRole("button", { name: "Manage categories" });
    expect(action.tagName).toBe("A");
    expect(action.getAttribute("href")).toMatch(/\/cash-flow\/categories\/?$/);

    const emptyState = screen.getByText("No categories yet.").closest('[data-slot="empty"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.classList.contains("border")).toBe(true);
    expect(emptyState?.classList.contains("border-dashed")).toBe(true);
    expect(emptyState?.querySelector('[data-slot="empty-icon"]')).not.toBeNull();
  });

  it("clears single selection when clearable", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={categories}
        value="food"
        onChange={onChange}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
        clearable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
