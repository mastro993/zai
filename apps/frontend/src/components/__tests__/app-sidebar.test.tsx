// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "../app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as windowChrome from "@/lib/window-chrome";

const stubMatchMedia = () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
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

async function renderSidebar(ui: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
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

describe("AppSidebar", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the web toggle beside the logo when expanded", async () => {
    mockWindowChrome(false);
    await renderSidebar(
      <SidebarProvider>
        <AppSidebar buildTarget="web" />
      </SidebarProvider>,
    );

    const header = document.querySelector('[data-slot="sidebar-chrome-header"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const toggle = screen.getByRole("button", { name: "Toggle Sidebar" });

    expect(document.querySelector('[data-slot="sidebar-window-chrome"]')).toBeNull();
    expect(header).not.toBeNull();
    expect(brand?.textContent).toContain("Zai");
    expect(header?.contains(brand)).toBe(true);
    expect(header?.contains(toggle)).toBe(true);
  });

  it("reveals the web toggle on hover when the icon rail is collapsed", async () => {
    mockWindowChrome(false);
    await renderSidebar(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar buildTarget="web" />
      </SidebarProvider>,
    );

    expect(document.querySelector('[data-slot="sidebar-collapsed-chrome"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
  });

  it("puts the desktop logo below the traffic-light chrome, not beside the toggle", async () => {
    mockWindowChrome(true);
    await renderSidebar(
      <SidebarProvider>
        <AppSidebar buildTarget="tauri" />
      </SidebarProvider>,
    );

    const chrome = document.querySelector('[data-slot="sidebar-window-chrome"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const header = document.querySelector('[data-slot="sidebar-header"]');

    expect(chrome).not.toBeNull();
    expect(brand?.textContent).toContain("Zai");
    expect(chrome?.contains(brand)).toBe(false);
    expect(header?.contains(brand)).toBe(true);
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });
});
