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

const renderOverlay = async (
  buildTarget: "tauri" | "web",
  sidebarOpen = true,
  initialEntry = "/",
) => {
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
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => null,
  });
  const appearanceRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "appearance",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, settingsRoute.addChildren([appearanceRoute])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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

  it("shows the overlay toggle without history when the web sidebar is collapsed", async () => {
    mockWindowChrome(false);
    await renderOverlay("web", false);

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go forward" })).toBeNull();
    expect(host?.style.paddingLeft).toBe(TRAFFIC_LIGHT_TO_TRIGGER_GAP);
    expect(document.querySelector('[data-slot="window-chrome-history"]')).toBeNull();
  });

  it("sits after the traffic lights on overlay-chrome desktops, with history arrows next to the toggle", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri");

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    const history = document.querySelector<HTMLElement>('[data-slot="window-chrome-history"]');
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(host?.contains(screen.getByRole("button", { name: "Go back" }))).toBe(true);
    expect(host?.style.paddingLeft).toBe(NATIVE_TOGGLE_LEADING_INSET);
    expect(host?.style.gap).toBe(TRIGGER_TO_HISTORY_GAP);
    expect(host?.className).not.toContain("w-(--sidebar-width)");
    expect(history?.className).not.toContain("ml-auto");
    expect(document.querySelector('[data-slot="sidebar-brand"]')).toBeNull();
  });

  it("packs history closer to the toggle than the traffic-light inset when Tauri sidebar is offcanvas-collapsed", async () => {
    mockWindowChrome(false);
    await renderOverlay("tauri", false);

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    const history = document.querySelector<HTMLElement>('[data-slot="window-chrome-history"]');
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(host?.style.paddingLeft).toBe(TRAFFIC_LIGHT_TO_TRIGGER_GAP);
    expect(host?.style.gap).toBe(TRIGGER_TO_HISTORY_GAP);
    expect(history?.className).not.toContain("ml-auto");
    expect(document.querySelector('[data-slot="sidebar-brand"]')).toBeNull();
  });

  it("packs history closer to the toggle when overlay chrome is collapsed", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri", false);

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    expect(host?.style.paddingLeft).toBe(NATIVE_TOGGLE_LEADING_INSET);
    expect(host?.style.gap).toBe(TRIGGER_TO_HISTORY_GAP);
    expect(host?.className).not.toContain("w-(--sidebar-width)");
    expect(document.querySelector('[data-slot="sidebar-brand"]')).toBeNull();
  });

  it("hides the overlay collapse control on settings paths and keeps Tauri history", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri", true, "/settings/appearance");

    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(document.querySelector('[data-slot="window-chrome-history"]')).not.toBeNull();
  });

  it("treats settings as expanded even when the stored preference is collapsed", async () => {
    mockWindowChrome(true);
    await renderOverlay("tauri", false, "/settings/appearance");

    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
  });
});
