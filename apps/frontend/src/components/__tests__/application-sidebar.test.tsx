// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationSidebar } from "../application-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsReturnHrefProvider } from "@/features/settings/hooks/use-settings-return-href";
import * as windowChrome from "@/lib/window-chrome";

const stubMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const maxWidth = /max-width:\s*(\d+)/.exec(query);
      const minWidth = /min-width:\s*(\d+)/.exec(query);
      let matches = false;
      if (maxWidth) {
        matches = window.innerWidth <= Number(maxWidth[1]);
      } else if (minWidth) {
        matches = window.innerWidth >= Number(minWidth[1]);
      }

      return {
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches,
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      };
    },
  });
};

const mockWindowChrome = (supportsNativeWindowChrome: boolean) => {
  vi.spyOn(windowChrome, "createWindowChromeAdapter").mockReturnValue({
    supportsNativeWindowChrome,
    usesCustomWindowControls: false,
    startDragging: vi.fn(),
    toggleMaximize: vi.fn(),
    minimize: vi.fn(),
    close: vi.fn(),
  });
};

const SidebarProbe = ({ buildTarget }: { buildTarget: "web" | "tauri" }) => (
  <SettingsReturnHrefProvider>
    <SidebarProvider>
      <ApplicationSidebar buildTarget={buildTarget} />
      <Outlet />
    </SidebarProvider>
  </SettingsReturnHrefProvider>
);

const renderSidebar = async (initialEntry: string, buildTarget: "web" | "tauri" = "web") => {
  const rootRoute = createRootRoute({
    component: () => <SidebarProbe buildTarget={buildTarget} />,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <p>Dashboard page</p>,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <Outlet />,
  });
  const appearanceRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "appearance",
    component: () => <p>Appearance page</p>,
  });
  const aboutRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "about",
    component: () => <p>About page</p>,
  });
  const currenciesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "currencies",
    component: () => <p>Currencies page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute,
      settingsRoute.addChildren([appearanceRoute, aboutRoute, currenciesRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("ApplicationSidebar", () => {
  beforeEach(() => {
    stubMatchMedia();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the web toggle beside the logo when expanded", async () => {
    mockWindowChrome(false);
    await renderSidebar("/dashboard");

    const header = document.querySelector('[data-slot="sidebar-chrome-header"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const toggle = screen.getByRole("button", { name: "Toggle Sidebar" });

    expect(document.querySelector('[data-slot="sidebar-window-chrome"]')).toBeNull();
    expect(header).not.toBeNull();
    expect(brand?.textContent).toContain("Zai");
    expect(header?.contains(brand)).toBe(true);
    expect(header?.contains(toggle)).toBe(true);
    expect(header?.className).toContain("border-b");
    expect(header?.className).toContain("border-border");
  });

  it("puts the desktop logo below the traffic-light chrome, not beside the toggle", async () => {
    mockWindowChrome(true);
    await renderSidebar("/dashboard", "tauri");

    const chrome = document.querySelector('[data-slot="sidebar-window-chrome"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const header = document.querySelector('[data-slot="sidebar-header"]');

    expect(chrome).not.toBeNull();
    expect(chrome?.className).not.toContain("border-b");
    expect(brand?.textContent).toContain("Zai");
    expect(chrome?.contains(brand)).toBe(false);
    expect(header?.contains(brand)).toBe(true);
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });

  it("keeps app navigation without a settings back control on the main workspace", async () => {
    await renderSidebar("/dashboard");

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
  });

  it("sits above the status bar and overlays it while offcanvas is collapsed", async () => {
    mockWindowChrome(true);
    await renderSidebar("/dashboard", "tauri");

    const container = document.querySelector('[data-slot="sidebar-container"]');
    expect(container?.className).toContain("bottom-8");
    expect(container?.className).toContain("group-data-[collapsible=offcanvas]:bottom-0");
  });

  it("keeps app navigation when settings is open", async () => {
    const router = await renderSidebar("/dashboard");

    await router.navigate({ to: "/settings/appearance" });

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("link", { name: "About" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Currencies" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("keeps the previous app item active while settings is open", async () => {
    const router = await renderSidebar("/dashboard");

    await router.navigate({ to: "/settings/appearance" });

    const dashboard = await screen.findByRole("link", { name: "Dashboard" });
    expect(dashboard.hasAttribute("data-active")).toBe(true);
  });
});
