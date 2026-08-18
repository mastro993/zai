// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";

import { categorySchema } from "../../types/model";
import { CategoryScreen } from "../category-screen";

const food = categorySchema.parse({
  id: "food",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C55B26",
  role: "spending",
  parent: null,
});

const idleAlertsController: AlertsControllerValue = {
  bellRef: { current: null },
  clearFilters: () => undefined,
  closeLedger: () => undefined,
  destinationFeedback: null,
  errorMessage: null,
  filters: { readState: "all", severity: "all" },
  hasActiveFilters: false,
  isLedgerOpen: false,
  ledgerFocusAlertId: null,
  items: [],
  lifecycleErrors: {},
  lifecyclePendingId: null,
  loadOlder: async () => undefined,
  loadOlderError: null,
  loadOlderStatus: "idle",
  markAllRead: async () => undefined,
  markAllReadError: null,
  markAllReadPending: false,
  nextCursor: null,
  openAlert: async () => undefined,
  openLedger: () => undefined,
  refresh: async () => undefined,
  refreshStatus: "ready",
  setReadStateFilter: () => undefined,
  setSeverityFilter: () => undefined,
  toggleAlertReadState: async () => undefined,
  unreadCount: 0,
  unreadCountKnown: true,
};

function stubWindowChrome() {
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
}

async function renderCategoryScreen(ui: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <ApplicationTitleBarProvider>
          <ApplicationTitleBar buildTarget="web" />
          <Outlet />
        </ApplicationTitleBarProvider>
      </SidebarProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("CategoryScreen actions", () => {
  beforeEach(() => {
    stubWindowChrome();
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Categories" }]);
    vi.spyOn(alertsController, "useAlertsController").mockReturnValue(idleAlertsController);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("groups upload and download actions with tooltips", async () => {
    await renderCategoryScreen(<CategoryScreen initialCategories={[food]} />);

    const importAction = await screen.findByRole("button", { name: "Import categories" });
    const exportAction = screen.getByRole("button", { name: "Export categories" });
    const actionGroup = importAction.closest('[data-slot="button-group"]');

    expect(importAction.textContent).toBe("");
    expect(exportAction.textContent).toBe("");
    expect(actionGroup?.getAttribute("aria-label")).toBe("Category file actions");
    expect(actionGroup?.contains(exportAction)).toBe(true);
    expect(importAction.querySelector("svg")).not.toBeNull();
    expect(exportAction.querySelector("svg")).not.toBeNull();
    expect(importAction.classList.contains("size-7")).toBe(true);
    expect(exportAction.classList.contains("size-7")).toBe(true);

    fireEvent.focus(importAction);
    await waitFor(() => expect(screen.getByText("Import categories")).not.toBeNull());

    fireEvent.blur(importAction);
    fireEvent.focus(exportAction);
    await waitFor(() => expect(screen.getByText("Export categories")).not.toBeNull());
  });

  it("renders the empty state with one primary create action and import fallback", async () => {
    await renderCategoryScreen(<CategoryScreen initialCategories={[]} />);

    const emptyState = await screen.findByRole("region", { name: "Set up your categories" });
    const emptyContent = emptyState.querySelector('[data-slot="empty-content"]');

    expect(emptyState).not.toBeNull();
    expect(emptyState.classList.contains("rounded-lg")).toBe(true);
    expect(emptyState.querySelector('[data-slot="empty-icon"]')).not.toBeNull();
    expect(emptyContent?.classList.contains("justify-center")).toBe(true);
    expect(screen.getByRole("heading", { name: "Set up your categories" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "New category" })).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "Category file actions" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Import categories" })).toHaveLength(1);
  });

  it("keeps the header new category action when categories exist", async () => {
    await renderCategoryScreen(<CategoryScreen initialCategories={[food]} />);

    const newCategoryAction = await screen.findByRole("button", { name: "New category" });

    expect(newCategoryAction.classList.contains("h-7")).toBe(true);
    expect(screen.queryByRole("region", { name: "Set up your categories" })).toBeNull();
  });
});
