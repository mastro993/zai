// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationSidebar } from "@/components/application-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { THEME_STORAGE_KEY } from "@/lib/theme-toggle";
import { SettingsReturnHrefProvider } from "../../hooks/use-settings-return-href";

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

const renderSettingsChrome = async (initialEntry: string) => {
  stubMatchMedia();
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        storageKey={THEME_STORAGE_KEY}
      >
        <SettingsReturnHrefProvider>
          <SidebarProvider>
            <ApplicationSidebar buildTarget="web" />
            <Outlet />
          </SidebarProvider>
        </SettingsReturnHrefProvider>
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
  const diagnosticsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "diagnostics",
    component: () => <p>Diagnostics page</p>,
  });
  const currenciesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "currencies",
    component: () => <p>Currencies page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute,
      settingsRoute.addChildren([appearanceRoute, aboutRoute, diagnosticsRoute, currenciesRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("settings chrome", () => {
  beforeEach(() => {
    stubMatchMedia();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders settings in the app sidebar without a dialog", async () => {
    await renderSettingsChrome("/settings/appearance");

    expect(screen.queryByRole("dialog")).toBeNull();
    const search = screen.getByRole("searchbox", { name: "Search settings" });
    const sidebarSearch = document.querySelector('[data-slot="settings-sidebar-search"]');
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebarSearch?.contains(search)).toBe(true);
    expect(sidebar?.contains(sidebarSearch)).toBe(true);
    expect(document.querySelector('[data-slot="sidebar-container"]')).not.toBeNull();
    expect(search.getAttribute("placeholder")).toBe("Search settings");
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    expect(screen.getByText("Appearance page")).toBeTruthy();
  });

  it("changes the URL when section links are followed", async () => {
    const router = await renderSettingsChrome("/settings/appearance");

    const sectionsNav = await screen.findByRole("navigation", { name: "Settings sections" });
    fireEvent.click(within(sectionsNav).getByRole("link", { name: "Currencies" }));

    expect(await screen.findByText("Currencies page")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings/currencies");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns to the stored app path from Back", async () => {
    const router = await renderSettingsChrome("/dashboard");

    await router.navigate({ to: "/settings/appearance" });
    expect(await screen.findByText("Appearance page")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(await screen.findByText("Dashboard page")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
