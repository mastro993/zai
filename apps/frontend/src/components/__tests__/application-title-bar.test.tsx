// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import {
  ApplicationTitleBar,
  ApplicationTitleBarActions,
  ApplicationTitleBarProvider,
} from "../application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";

const startDragging = vi.fn();
const toggleMaximize = vi.fn();

vi.mock("@/features/alerts/components/alerts-bell", () => ({
  AlertsBell: () => <button type="button">Alerts</button>,
}));

vi.mock("@/hooks/use-screen-breadcrumbs", () => ({
  useScreenBreadcrumbs: () => [{ label: "Dashboard" }],
}));

vi.mock("@/lib/window-chrome", () => ({
  createWindowChromeAdapter: () => ({
    supportsNativeWindowChrome: true,
    startDragging,
    toggleMaximize,
  }),
}));

const renderTitleBar = (buildTarget: "tauri" | "web", actions?: ReactNode) =>
  render(
    <SidebarProvider>
      <ApplicationTitleBarProvider>
        <ApplicationTitleBar buildTarget={buildTarget} />
        <ApplicationTitleBarActions>{actions}</ApplicationTitleBarActions>
      </ApplicationTitleBarProvider>
    </SidebarProvider>,
  );

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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps breadcrumbs, alerts, and accessible sidebar control visible in web mode", () => {
    renderTitleBar("web", <button type="button">Route action</button>);

    expect(screen.getByRole("banner").getAttribute("data-build-target")).toBe("web");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Route action" })).toBeTruthy();
    expect(
      screen.getByRole("banner").querySelector('[data-slot="title-bar-drag-region"]'),
    ).toBeNull();
  });

  it("reserves native controls and limits actions to the empty primary-pointer region", () => {
    renderTitleBar("tauri", <button type="button">Route action</button>);
    const banner = screen.getByRole("banner");
    const leading = banner.querySelector<HTMLElement>('[data-slot="title-bar-leading"]');
    const dragRegion = banner.querySelector<HTMLElement>('[data-slot="title-bar-drag-region"]');
    const routeAction = screen.getByRole("button", { name: "Route action" });

    expect(leading?.style.paddingLeft).toBe("76px");
    expect(leading?.style.width).toBe("var(--sidebar-width)");
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
});
