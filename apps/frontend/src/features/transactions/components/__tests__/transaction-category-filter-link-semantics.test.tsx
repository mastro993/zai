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

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

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
  const routeTree = rootRoute.addChildren([indexRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();

  return render(<RouterProvider router={router} />);
}

describe("TransactionCategoryFilter link semantics", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
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
      consoleError.mock.calls.some((call: Array<unknown>) =>
        String(call[0]).includes("expected a native <button>"),
      ),
    ).toBe(false);
  });
});
