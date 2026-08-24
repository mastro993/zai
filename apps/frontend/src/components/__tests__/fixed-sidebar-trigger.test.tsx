// @vitest-environment jsdom

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FixedSidebarTrigger } from "../fixed-sidebar-trigger";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  NATIVE_TOGGLE_LEADING_INSET,
  TRAFFIC_LIGHT_TO_TRIGGER_GAP,
  TRIGGER_TO_HISTORY_GAP,
} from "@/components/window-drag-region";
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

const renderOverlay = async (buildTarget: "tauri" | "web", sidebarOpen = true) => {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider defaultOpen={sidebarOpen}>
        <FixedSidebarTrigger buildTarget={buildTarget} />
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

describe("FixedSidebarTrigger", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides on expanded web so the sidebar header can host the toggle", async () => {
    mockWindowChrome(false);
    await renderOverlay("web");

    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
  });

  it("sits after the traffic lights on overlay-chrome desktops, with history arrows right-aligned", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri");

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    const history = document.querySelector<HTMLElement>('[data-slot="window-chrome-history"]');
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(host?.contains(screen.getByRole("button", { name: "Go back" }))).toBe(true);
    expect(host?.style.paddingLeft).toBe(NATIVE_TOGGLE_LEADING_INSET);
    expect(host?.className).toContain("w-(--sidebar-width)");
    expect(history?.className).toContain("ml-auto");
  });

  it("packs history closer to the toggle than the traffic-light inset when Tauri sidebar is offcanvas-collapsed", async () => {
    mockWindowChrome(false);
    await renderOverlay("tauri", false);

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    const history = document.querySelector<HTMLElement>('[data-slot="window-chrome-history"]');
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(host?.style.paddingLeft).toBe(TRAFFIC_LIGHT_TO_TRIGGER_GAP);
    expect(host?.style.gap).toBe(TRIGGER_TO_HISTORY_GAP);
    expect(history?.className).not.toContain("ml-auto");
  });

  it("packs history closer to the toggle when overlay chrome is collapsed", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri", false);

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    expect(host?.style.paddingLeft).toBe(NATIVE_TOGGLE_LEADING_INSET);
    expect(host?.style.gap).toBe(TRIGGER_TO_HISTORY_GAP);
    expect(host?.className).not.toContain("w-(--sidebar-width)");
  });
});
