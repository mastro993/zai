// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FixedSidebarTrigger } from "../fixed-sidebar-trigger";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NATIVE_TOGGLE_LEADING_INSET } from "@/components/window-drag-region";
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

describe("FixedSidebarTrigger", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides on expanded web so the sidebar header can host the toggle", () => {
    mockWindowChrome(false);
    render(
      <SidebarProvider>
        <FixedSidebarTrigger buildTarget="web" />
      </SidebarProvider>,
    );

    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });

  it("sits after the traffic lights on overlay-chrome desktops", () => {
    mockWindowChrome(true);
    render(
      <SidebarProvider>
        <FixedSidebarTrigger buildTarget="tauri" />
      </SidebarProvider>,
    );

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(host?.style.paddingLeft).toBe(NATIVE_TOGGLE_LEADING_INSET);
  });

  it("keeps a left-edge toggle when the Tauri sidebar is offcanvas-collapsed", () => {
    mockWindowChrome(false);
    render(
      <SidebarProvider defaultOpen={false}>
        <FixedSidebarTrigger buildTarget="tauri" />
      </SidebarProvider>,
    );

    const host = document.querySelector<HTMLElement>('[data-slot="fixed-sidebar-trigger"]');
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(host?.style.paddingLeft).toBe("0.5rem");
  });
});
