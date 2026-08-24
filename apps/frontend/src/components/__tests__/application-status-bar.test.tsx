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
import { aboutPackageVersion, resolveAboutAppVersion } from "@/features/settings/lib/about-info";
import * as alertsBell from "@/features/alerts/components/alerts-bell";
import { THEME_STORAGE_KEY } from "@/lib/theme-toggle";

const stubColorScheme = (system: "light" | "dark") => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") && system === "dark",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const renderStatusBar = async ({
  stored,
  system = "light",
}: {
  stored?: "light" | "dark" | "system";
  system?: "light" | "dark";
} = {}) => {
  stubColorScheme(system);
  if (stored) {
    localStorage.setItem(THEME_STORAGE_KEY, stored);
  }

  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        storageKey={THEME_STORAGE_KEY}
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
    expect(bar?.className).toContain("z-40");
    expect(bar?.className).toContain("border-t");
    expect(bar?.className).toContain("border-sidebar-border");
  });

  it("opens settings from the gear control", async () => {
    await renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Settings page")).toBeTruthy();
  });

  it("does not highlight the settings control while settings is open", async () => {
    await renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByText("Settings page");

    expect(screen.getByRole("button", { name: "Settings" }).className.split(/\s+/)).not.toContain(
      "bg-sidebar-accent",
    );
  });

  it("pins dark when the system is light and Zai has no theme", async () => {
    await renderStatusBar({ system: "light" });

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("pins light when the system is dark and Zai has no theme", async () => {
    await renderStatusBar({ system: "dark" });

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("clears a dark pin back to a light system", async () => {
    await renderStatusBar({ stored: "dark", system: "light" });

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("clears a light pin back to a dark system", async () => {
    await renderStatusBar({ stored: "light", system: "dark" });

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("shows the current app version with alerts on the trailing edge", async () => {
    await renderStatusBar();

    const bar = document.querySelector('[data-slot="application-status-bar"]');
    const appVersion = resolveAboutAppVersion(aboutPackageVersion());
    const version = screen.getByLabelText(`Version ${appVersion}`);
    const alerts = screen.getByRole("button", { name: "Alerts" });

    expect(version.textContent).toContain(appVersion);
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
    const appVersion = resolveAboutAppVersion(aboutPackageVersion());
    const version = screen.getByLabelText(`Version ${appVersion}`);
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
