// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationSidebar } from "../application-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
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
  <SidebarProvider>
    <ApplicationSidebar buildTarget={buildTarget} />
    <Outlet />
  </SidebarProvider>
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
  });

  it("puts the desktop logo below the traffic-light chrome, not beside the toggle", async () => {
    mockWindowChrome(true);
    await renderSidebar("/dashboard", "tauri");

    const chrome = document.querySelector('[data-slot="sidebar-window-chrome"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const header = document.querySelector('[data-slot="sidebar-header"]');

    expect(chrome).not.toBeNull();
    expect(brand?.textContent).toContain("Zai");
    expect(chrome?.contains(brand)).toBe(false);
    expect(header?.contains(brand)).toBe(true);
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });

  it("keeps app navigation and a settings footer control on the main workspace", async () => {
    await renderSidebar("/dashboard");

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
  });

  it("replaces app navigation with settings sections and a back control", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));

    expect(await screen.findByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Currencies" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to app" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("keeps the web logo and puts Back to app in the Settings footer slot", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));

    const chromeHeader = document.querySelector('[data-slot="sidebar-chrome-header"]');
    const footer = document.querySelector('[data-slot="sidebar-footer"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const back = await screen.findByRole("button", { name: "Back to app" });

    expect(brand?.textContent).toContain("Zai");
    expect(chromeHeader?.contains(brand)).toBe(true);
    expect(chromeHeader?.contains(back)).toBe(false);
    expect(footer?.contains(back)).toBe(true);
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Finance")).toBeTruthy();
  });

  it("keeps the desktop logo and puts Back to app in the footer slot", async () => {
    mockWindowChrome(true);
    await renderSidebar("/dashboard", "tauri");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));

    const header = document.querySelector('[data-slot="sidebar-header"]');
    const footer = document.querySelector('[data-slot="sidebar-footer"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const back = await screen.findByRole("button", { name: "Back to app" });

    expect(brand?.textContent).toContain("Zai");
    expect(header?.contains(brand)).toBe(true);
    expect(header?.contains(back)).toBe(false);
    expect(footer?.contains(back)).toBe(true);
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });

  it("returns to the previous app screen from the back control", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("button", { name: "Back to app" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to app" }));

    expect(await screen.findByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Dashboard page")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
  });
});
