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
      startDragging,
      toggleMaximize,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps breadcrumbs, alerts, and route actions visible in web mode", async () => {
    await renderTitleBar("web", <button type="button">Route action</button>);

    expect(screen.getByRole("banner").getAttribute("data-build-target")).toBe("web");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    // Toggle lives in FixedSidebarTrigger (shell), not the title bar.
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Route action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="navigation-history-buttons"]'),
    ).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="title-bar-history-separator"]'),
    ).toBeNull();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="title-bar-drag-region"]'),
    ).toBeNull();
  });

  it("aligns expanded title-bar breadcrumbs with page content", async () => {
    await renderTitleBar("tauri", <button type="button">Route action</button>);
    const banner = screen.getByRole("banner");
    const leading = banner.querySelector<HTMLElement>('[data-slot="title-bar-leading"]');
    const dragRegion = banner.querySelector<HTMLElement>('[data-slot="title-bar-drag-region"]');
    const routeAction = screen.getByRole("button", { name: "Route action" });

    // Expanded desktop: fixed toggle sits over the sidebar, not the content title bar.
    expect(leading?.style.paddingLeft).toBe("1rem");
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(banner.querySelector('[data-slot="title-bar-history-separator"]')).toBeNull();
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
    const history = banner.querySelector('[data-slot="navigation-history-buttons"]');
    const separator = banner.querySelector('[data-slot="title-bar-history-separator"]');
    const breadcrumbs = banner.querySelector('[data-slot="title-bar-breadcrumbs"]');

    // jsdom may reorder calc() terms; assert the chrome pieces are present.
    const padding = leading?.style.paddingLeft ?? "";
    expect(padding.startsWith("calc(")).toBe(true);
    expect(padding).toContain("76px");
    expect(padding).toContain("0.5rem");
    expect(padding).toContain("2rem");
    expect(history).not.toBeNull();
    expect(separator).not.toBeNull();
    expect(history?.nextElementSibling).toBe(separator);
    expect(separator?.nextElementSibling).toBe(breadcrumbs);
  });

  it("keeps history chrome out of the web title bar when the sidebar is collapsed", async () => {
    await renderTitleBar("web", undefined, false);

    const banner = screen.getByRole("banner");
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(banner.querySelector('[data-slot="navigation-history-buttons"]')).toBeNull();
    expect(banner.querySelector('[data-slot="title-bar-history-separator"]')).toBeNull();
  });
});
