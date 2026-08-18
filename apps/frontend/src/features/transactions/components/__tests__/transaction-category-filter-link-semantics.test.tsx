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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CATEGORY_FILTER_SELECTION } from "../../lib/transaction-category-filter";
import { TransactionCategoryFilter } from "../transaction-category-filter";

async function renderTransactionCategoryFilter() {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <TransactionCategoryFilter
        categories={[]}
        selection={DEFAULT_CATEGORY_FILTER_SELECTION}
        onSelectionChange={() => undefined}
      />
    ),
  });
  const categoriesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/categories",
    component: () => <div>Categories</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, categoriesRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();

  return render(<RouterProvider router={router} />);
}

describe("TransactionCategoryFilter link semantics", () => {
  let consoleError: { mock: { calls: Array<Array<string>> } };

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders Manage categories as an accessible anchor without native-button warnings", async () => {
    await renderTransactionCategoryFilter();

    const filterTrigger = await screen.findByRole("button", { name: "Filter by category" });
    fireEvent.click(filterTrigger);

    const control = screen.getByRole("button", { name: "Manage categories" });
    expect(control.tagName).toBe("A");
    expect(control.getAttribute("href")).toMatch(/\/cash-flow\/categories\/?$/);
    expect(
      consoleError.mock.calls.some((call) =>
        String(call[0]).includes("expected a native <button>"),
      ),
    ).toBe(false);
  });
});
