// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FixedSidebarTrigger } from "../fixed-sidebar-trigger";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NATIVE_TOGGLE_LEADING_INSET } from "@/components/window-drag-region";
import {
  AlertsControllerContext,
  type AlertsControllerValue,
} from "@/features/alerts/hooks/alerts-controller-context";
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

const stubAlertsController = (unreadCount = 0): AlertsControllerValue => ({
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
  unreadCount,
  unreadCountKnown: true,
});

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

  it("badges the desktop expand toggle when collapsed with unread alerts", () => {
    mockWindowChrome(false);
    render(
      <AlertsControllerContext.Provider value={stubAlertsController(3)}>
        <SidebarProvider defaultOpen={false}>
          <FixedSidebarTrigger buildTarget="tauri" />
        </SidebarProvider>
      </AlertsControllerContext.Provider>,
    );

    const host = document.querySelector('[data-slot="fixed-sidebar-trigger"]');
    const badge = document.querySelector('[data-slot="unread-alerts-badge"]');
    expect(host?.contains(badge)).toBe(true);
    expect(badge?.classList.contains("animate-pulse")).toBe(false);
  });

  it("does not badge the desktop toggle when the sidebar is expanded", () => {
    mockWindowChrome(true);
    render(
      <AlertsControllerContext.Provider value={stubAlertsController(3)}>
        <SidebarProvider>
          <FixedSidebarTrigger buildTarget="tauri" />
        </SidebarProvider>
      </AlertsControllerContext.Provider>,
    );

    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
    expect(document.querySelector('[data-slot="unread-alerts-badge"]')).toBeNull();
  });
});
