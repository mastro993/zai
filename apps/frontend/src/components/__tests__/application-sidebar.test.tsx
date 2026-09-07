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
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationSidebar } from "../application-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsReturnHrefProvider } from "@/features/settings/hooks/use-settings-return-href";
import {
  SIDEBAR_PREFERENCE_STORAGE_KEY,
  SIDEBAR_PREFERENCE_VERSION,
  readSidebarOpen,
  writeSidebarOpen,
} from "@/lib/sidebar-preference";
import { THEME_STORAGE_KEY } from "@/lib/theme-toggle";
import * as windowChrome from "@/lib/window-chrome";
import {
  sidebarOpenForChrome,
  shouldPersistSidebarOpen,
  useWorkspaceChrome,
} from "@/lib/workspace-chrome";

const stubMatchMedia = (system: "light" | "dark" = "light") => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const maxWidth = /max-width:\s*(\d+)/.exec(query);
      const minWidth = /min-width:\s*(\d+)/.exec(query);
      let matches = false;
      if (query.includes("prefers-color-scheme: dark")) {
        matches = system === "dark";
      } else if (maxWidth) {
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

const persistCollapsedPreference = () => {
  writeSidebarOpen(false);
};

const SidebarProbe = ({ buildTarget }: { buildTarget: "web" | "tauri" }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
    storageKey={THEME_STORAGE_KEY}
  >
    <SettingsReturnHrefProvider>
      <WorkspaceSidebarProbe buildTarget={buildTarget} />
    </SettingsReturnHrefProvider>
  </ThemeProvider>
);

const WorkspaceSidebarProbe = ({ buildTarget }: { buildTarget: "web" | "tauri" }) => {
  const chrome = useWorkspaceChrome();
  const [sidebarOpen, setSidebarOpen] = useState(() => readSidebarOpen());

  return (
    <SidebarProvider
      open={sidebarOpenForChrome(chrome, sidebarOpen)}
      onOpenChange={(open) => {
        if (!shouldPersistSidebarOpen(chrome)) {
          return;
        }
        setSidebarOpen(open);
        writeSidebarOpen(open);
      }}
    >
      <ApplicationSidebar buildTarget={buildTarget} />
      <Outlet />
    </SidebarProvider>
  );
};

const renderSidebar = async (
  initialEntry: string,
  buildTarget: "web" | "tauri" = "web",
  system: "light" | "dark" = "light",
) => {
  stubMatchMedia(system);
  const rootRoute = createRootRoute({
    component: () => <SidebarProbe buildTarget={buildTarget} />,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <p>Dashboard page</p>,
  });
  const cashFlowRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow",
    component: () => <Outlet />,
  });
  const cashFlowBudgetsRoute = createRoute({
    getParentRoute: () => cashFlowRoute,
    path: "budgets",
    component: () => <p>Budgets page</p>,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => (
      <>
        <p>Settings page</p>
        <Outlet />
      </>
    ),
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
  const diagnosticsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "diagnostics",
    component: () => <p>Diagnostics page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute,
      cashFlowRoute.addChildren([cashFlowBudgetsRoute]),
      settingsRoute.addChildren([appearanceRoute, aboutRoute, currenciesRoute, diagnosticsRoute]),
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
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("keeps the web toggle beside the logo when expanded", async () => {
    mockWindowChrome(false);
    await renderSidebar("/dashboard");

    const header = document.querySelector('[data-slot="sidebar-chrome-header"]');
    const brand = document.querySelector('[data-slot="sidebar-brand"][data-wordmark="true"]');
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });

    expect(document.querySelector('[data-slot="sidebar-window-chrome"]')).toBeNull();
    expect(header).not.toBeNull();
    expect(brand?.textContent).toContain("Zai");
    expect(header?.contains(brand)).toBe(true);
    expect(header?.contains(toggle)).toBe(true);
    expect(toggle.className).toContain("hover:bg-sidebar-accent");
    expect(toggle.className).toContain("aria-expanded:hover:bg-sidebar-accent");
    expect(header?.className).not.toContain("border-b");
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
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
  });

  it("keeps app navigation without a settings back control on the main workspace", async () => {
    await renderSidebar("/dashboard");

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
  });

  it("swaps the sidebar to settings groups when settings is open", async () => {
    const router = await renderSidebar("/dashboard");

    await router.navigate({ to: "/settings/appearance" });

    const sectionsNav = await screen.findByRole("navigation", { name: "Settings sections" });
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Currencies" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Diagnostics" })).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(sectionsNav.contains(screen.getByRole("link", { name: "Appearance" }))).toBe(true);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByText("Net Worth")).toBeNull();
    expect(screen.queryByText("Cash flow")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "App" })).toBeNull();

    const footer = document.querySelector('[data-slot="sidebar-footer"]');
    const back = screen.getByRole("link", { name: "Back" });
    expect(footer?.contains(back)).toBe(true);
    expect(back.querySelector("svg")).not.toBeNull();
    expect(back.firstElementChild?.tagName.toLowerCase()).toBe("svg");

    const search = screen.getByRole("searchbox", { name: "Search settings" });
    const sidebarSearch = document.querySelector('[data-slot="settings-sidebar-search"]');
    const header = document.querySelector('[data-slot="sidebar-header"]');
    expect(sidebarSearch?.contains(search)).toBe(true);
    expect(header?.contains(sidebarSearch)).toBe(true);
    expect(document.querySelector('[data-slot="sidebar-brand"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull();
  });

  it("labels Cash flow as a group, not a current page link", async () => {
    const router = await renderSidebar("/dashboard");

    await router.navigate({ to: "/cash-flow/budgets" });

    expect(screen.queryByRole("link", { name: "Cash flow" })).toBeNull();
    expect(screen.getByText("Cash flow")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "App" })).toBeTruthy();
    const budgets = await screen.findByRole("link", { name: "Budgets" });
    expect(budgets.getAttribute("aria-current")).toBe("page");
  });

  it("pins settings above a hairline and the footer icon row", async () => {
    await renderSidebar("/dashboard");

    const footer = document.querySelector('[data-slot="sidebar-footer"]');
    const settings = screen.getByRole("button", { name: "Settings" });
    const contribute = screen.getByRole("button", { name: "Contribute" });
    const documentation = screen.getByRole("button", { name: "Documentation" });
    const theme = await screen.findByRole("button", { name: "Switch to dark mode" });
    const divider = footer?.querySelector('[data-slot="sidebar-separator"]');
    const row = divider?.nextElementSibling;

    expect(footer).not.toBeNull();
    expect(footer?.contains(settings)).toBe(true);
    expect(settings.nextElementSibling).toBe(divider);
    expect(row?.contains(contribute)).toBe(true);
    expect(row?.contains(documentation)).toBe(true);
    expect(row?.contains(theme)).toBe(true);
    expect(
      contribute.compareDocumentPosition(documentation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      documentation.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(theme.className).toContain("ml-auto");
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("keeps contribute and documentation as no-ops", async () => {
    const router = await renderSidebar("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Contribute" }));
    fireEvent.click(screen.getByRole("button", { name: "Documentation" }));

    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("opens settings from the footer control without highlighting it", async () => {
    const router = await renderSidebar("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Settings page")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings");
    const back = screen.getByRole("link", { name: "Back" });
    expect(back.hasAttribute("data-active")).toBe(false);
  });

  it("keeps a collapsed preference while settings forces the sidebar open", async () => {
    persistCollapsedPreference();
    const router = await renderSidebar("/dashboard");

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(readSidebarOpen()).toBe(false);

    await router.navigate({ to: "/settings/appearance" });

    expect(await screen.findByRole("searchbox", { name: "Search settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull();
    expect(readSidebarOpen()).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(readSidebarOpen()).toBe(false);
    expect(JSON.parse(localStorage.getItem(SIDEBAR_PREFERENCE_STORAGE_KEY) ?? "{}")).toEqual({
      version: SIDEBAR_PREFERENCE_VERSION,
      open: false,
    });
  });

  it("pins dark when the system is light and Zai has no theme", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("pins light when the system is dark and Zai has no theme", async () => {
    await renderSidebar("/dashboard", "web", "dark");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("clears a dark pin back to a light system", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("clears a light pin back to a dark system", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    await renderSidebar("/dashboard", "web", "dark");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
