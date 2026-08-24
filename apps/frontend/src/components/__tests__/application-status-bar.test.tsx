// @vitest-environment jsdom

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationStatusBar } from "../application-status-bar";
import { ABOUT_APP_VERSION } from "@/features/settings/lib/about-info";
import * as alertsBell from "@/features/alerts/components/alerts-bell";

const renderStatusBar = async (theme: "light" | "dark" = "light") => {
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider
        attribute="class"
        defaultTheme={theme}
        disableTransitionOnChange
        enableSystem={false}
        storageKey="zai-theme"
      >
        <ApplicationStatusBar />
        <Outlet />
      </ThemeProvider>
    ),
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <p>Dashboard page</p>,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <p>Settings page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("ApplicationStatusBar", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.spyOn(alertsBell, "AlertsBell").mockImplementation(() => (
      <button type="button">Alerts</button>
    ));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("uses sidebar surface color and a top border", async () => {
    await renderStatusBar();

    const bar = document.querySelector('[data-slot="application-status-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain("bg-sidebar");
    expect(bar?.className).toContain("z-[100001]");
    expect(bar?.className).toContain("border-t");
    expect(bar?.className).toContain("border-sidebar-border");
  });

  it("opens settings from the gear control", async () => {
    await renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Settings page")).toBeTruthy();
  });

  it("toggles dark mode from the sun/moon control", async () => {
    await renderStatusBar("light");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(localStorage.getItem("zai-theme")).toBe("dark");
  });

  it("shows a sun control while dark mode is active", async () => {
    await renderStatusBar("dark");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(localStorage.getItem("zai-theme")).toBe("light");
  });

  it("shows the current app version with alerts on the trailing edge", async () => {
    await renderStatusBar();

    const bar = document.querySelector('[data-slot="application-status-bar"]');
    const version = screen.getByLabelText(`Version ${ABOUT_APP_VERSION}`);
    const alerts = screen.getByRole("button", { name: "Alerts" });

    expect(version.textContent).toContain(ABOUT_APP_VERSION);
    expect(bar?.contains(version)).toBe(true);
    expect(bar?.contains(alerts)).toBe(true);
    expect(version.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("toggles TanStack Devtools from a control after the version", async () => {
    const onOpen = vi.fn();
    const trigger = document.createElement("button");
    trigger.setAttribute("aria-label", "Open TanStack Devtools");
    trigger.addEventListener("click", onOpen);
    document.body.append(trigger);

    await renderStatusBar();

    const bar = document.querySelector('[data-slot="application-status-bar"]');
    const version = screen.getByLabelText(`Version ${ABOUT_APP_VERSION}`);
    const devtools = screen.getByRole("button", { name: "TanStack Devtools" });
    const alerts = screen.getByRole("button", { name: "Alerts" });

    expect(bar?.contains(devtools)).toBe(true);
    expect(
      version.compareDocumentPosition(devtools) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      devtools.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(devtools);

    expect(onOpen).toHaveBeenCalledTimes(1);
    trigger.remove();
  });
});
