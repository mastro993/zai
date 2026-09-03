// @vitest-environment jsdom

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import {
  ApplicationTitleBar,
  ApplicationTitleBarActions,
  ApplicationTitleBarProvider,
} from "../application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WEB_CHROME_LEADING_INSET } from "@/components/window-drag-region";
import * as alertsBell from "@/features/alerts/components/alerts-bell";
import * as screenBreadcrumbs from "@/hooks/use-screen-breadcrumbs";
import * as windowChrome from "@/lib/window-chrome";

const startDragging = vi.fn();
const toggleMaximize = vi.fn();

const renderTitleBar = async (
  buildTarget: "tauri" | "web",
  actions?: ReactNode,
  sidebarOpen = true,
) => {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider defaultOpen={sidebarOpen}>
        <ApplicationTitleBarProvider>
          <ApplicationTitleBar buildTarget={buildTarget} />
          <ApplicationTitleBarActions>{actions}</ApplicationTitleBarActions>
        </ApplicationTitleBarProvider>
      </SidebarProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
};

describe("ApplicationTitleBar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    startDragging.mockReset();
    toggleMaximize.mockReset();
    vi.spyOn(alertsBell, "AlertsBell").mockImplementation(() => (
      <button type="button">Alerts</button>
    ));
    vi.spyOn(screenBreadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Dashboard" }]);
    vi.spyOn(windowChrome, "createWindowChromeAdapter").mockReturnValue({
      supportsNativeWindowChrome: true,
      usesCustomWindowControls: false,
      startDragging,
      toggleMaximize,
      minimize: vi.fn(),
      close: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps breadcrumbs and route actions visible in web mode", async () => {
    await renderTitleBar("web", <button type="button">Route action</button>);

    expect(screen.getByRole("banner").getAttribute("data-build-target")).toBe("web");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Route action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="navigation-history-buttons"]'),
    ).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="title-bar-overlay-separator"]'),
    ).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="title-bar-drag-region"]'),
    ).toBeNull();
  });

  it("pins the alerts bell on the trailing edge of the title bar", async () => {
    await renderTitleBar("web", <button type="button">Route action</button>);

    const banner = screen.getByRole("banner");
    const actions = banner.querySelector('[data-slot="title-bar-actions"]');
    const routeActions = banner.querySelector('[data-slot="title-bar-route-actions"]');
    const alerts = screen.getByRole("button", { name: "Alerts" });
    const routeAction = screen.getByRole("button", { name: "Route action" });

    expect(actions?.contains(alerts)).toBe(true);
    expect(routeActions?.nextElementSibling).toBe(alerts);
    expect(
      routeAction.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("aligns expanded title-bar breadcrumbs with page content", async () => {
    await renderTitleBar("tauri", <button type="button">Route action</button>);
    const banner = screen.getByRole("banner");
    const leading = banner.querySelector<HTMLElement>('[data-slot="title-bar-leading"]');
    const dragRegion = banner.querySelector<HTMLElement>('[data-slot="title-bar-drag-region"]');
    const routeAction = screen.getByRole("button", { name: "Route action" });

    expect(leading?.style.paddingLeft).toBe("1rem");
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(banner.querySelector('[data-slot="navigation-history-buttons"]')).toBeNull();
    expect(banner.querySelector('[data-slot="title-bar-overlay-separator"]')).toBeNull();
    expect(banner.querySelector("[data-tauri-drag-region]")).toBeNull();
    expect(dragRegion).not.toBeNull();
    if (!dragRegion) {
      return;
    }

    fireEvent.pointerDown(dragRegion, { button: 2 });
    fireEvent.pointerDown(dragRegion, { button: 1 });
    fireEvent.pointerDown(dragRegion, { button: 0 });
    fireEvent.doubleClick(dragRegion, { button: 2 });
    fireEvent.doubleClick(dragRegion, { button: 0 });
    fireEvent.pointerDown(routeAction, { button: 0 });
    fireEvent.doubleClick(routeAction, { button: 0 });

    const interactiveDescendant = document.createElement("button");
    dragRegion.append(interactiveDescendant);
    fireEvent.pointerDown(interactiveDescendant, { button: 0 });
    fireEvent.doubleClick(interactiveDescendant, { button: 0 });

    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
  });

  it("clears fixed traffic-light + toggle chrome when the sidebar is collapsed on desktop", async () => {
    await renderTitleBar("tauri", undefined, false);

    const banner = screen.getByRole("banner");
    const leading = banner.querySelector<HTMLElement>('[data-slot="title-bar-leading"]');
    const breadcrumbs = banner.querySelector('[data-slot="title-bar-breadcrumbs"]');

    // jsdom may reorder calc() terms; assert overlay chrome clearance (lights + toggle + history).
    const padding = leading?.style.paddingLeft ?? "";
    expect(padding.startsWith("calc(")).toBe(true);
    expect(padding).toContain("76px");
    expect(padding).toContain("0.5rem");
    expect(padding).toContain("0.25rem");
    expect(padding).toContain("2rem");
    expect(padding).toContain("3.5rem");
    expect(banner.querySelector('[data-slot="navigation-history-buttons"]')).toBeNull();
    const separator = banner.querySelector('[data-slot="title-bar-overlay-separator"]');
    expect(separator).not.toBeNull();
    // data-vertical: beats Separator's data-vertical:self-stretch (plain self-center loses).
    expect(separator?.className).toContain("data-vertical:h-4");
    expect(separator?.className).toContain("data-vertical:self-center");
    expect(separator?.nextElementSibling).toBe(breadcrumbs);
    expect(breadcrumbs).not.toBeNull();
  });

  it("clears overlay toggle chrome without history when the web sidebar is collapsed", async () => {
    await renderTitleBar("web", undefined, false);

    const banner = screen.getByRole("banner");
    const leading = banner.querySelector<HTMLElement>('[data-slot="title-bar-leading"]');
    const breadcrumbs = banner.querySelector('[data-slot="title-bar-breadcrumbs"]');
    const padding = leading?.style.paddingLeft ?? "";
    const serializedInset = document.createElement("div");
    serializedInset.style.paddingLeft = WEB_CHROME_LEADING_INSET;

    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(banner.querySelector('[data-slot="navigation-history-buttons"]')).toBeNull();
    expect(padding).toBe(serializedInset.style.paddingLeft);
    expect(WEB_CHROME_LEADING_INSET).toContain("0.5rem");
    expect(WEB_CHROME_LEADING_INSET).toContain("2rem");
    expect(padding).not.toContain("76px");
    expect(padding).not.toContain("3.5rem");
    const separator = banner.querySelector('[data-slot="title-bar-overlay-separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.nextElementSibling).toBe(breadcrumbs);
  });
});
