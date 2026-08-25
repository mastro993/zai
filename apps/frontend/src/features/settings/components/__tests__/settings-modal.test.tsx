// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsReturnHrefProvider } from "../../hooks/use-settings-return-href";
import { SettingsModal } from "../settings-modal";

const renderSettingsModal = async (initialEntry: string) => {
  const rootRoute = createRootRoute({
    component: () => (
      <SettingsReturnHrefProvider>
        <Outlet />
      </SettingsReturnHrefProvider>
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
    component: () => (
      <SettingsModal>
        <Outlet />
      </SettingsModal>
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
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute,
      settingsRoute.addChildren([appearanceRoute, aboutRoute, currenciesRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("SettingsModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens a large dialog with the settings sidebar", async () => {
    await renderSettingsModal("/settings/appearance");

    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    const content = document.querySelector('[data-slot="dialog-content"]');

    expect(dialog).toBeTruthy();
    expect(content?.className).toContain("h-[90dvh]");
    expect(content?.className).toContain("w-[90vw]");
    expect(content?.className).toContain("md:flex-row");

    const sidebar = document.querySelector('[data-slot="settings-modal-sidebar"]');
    const header = document.querySelector('[data-slot="settings-modal-header"]');
    const title = screen.getByRole("heading", { name: "Settings" });
    const closeButton = screen.getByRole("button", { name: "Close" });
    const sectionsNav = screen.getByRole("navigation", { name: "Settings sections" });
    const breadcrumbs = screen.getByRole("navigation", { name: "breadcrumb" });

    expect(sidebar).not.toBeNull();
    expect(header).not.toBeNull();
    expect(document.querySelector('[data-slot="settings-modal-sidebar-header"]')).toBeNull();
    expect(document.querySelector('[data-slot="settings-modal-sidebar-footer"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to app" })).toBeNull();
    expect(sidebar?.contains(title)).toBe(true);
    expect(title.className).toContain("sr-only");
    expect(sidebar?.contains(header)).toBe(false);
    expect(header?.contains(closeButton)).toBe(true);
    expect(header?.contains(breadcrumbs)).toBe(true);
    expect(header?.className).toContain("h-12");
    expect(header?.className).toContain("border-b");

    expect(within(breadcrumbs).getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(within(breadcrumbs).getByText("Appearance")).toBeTruthy();

    const search = screen.getByRole("searchbox", { name: "Search settings" });
    const sidebarSearch = document.querySelector('[data-slot="settings-modal-sidebar-search"]');
    expect(sidebarSearch?.contains(search)).toBe(true);
    expect(sidebarSearch?.className).toContain("h-12");
    expect(search.getAttribute("placeholder")).toBe("Search settings");
    fireEvent.change(search, { target: { value: "appearance" } });
    expect(screen.getByText("Appearance page")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();

    expect(sectionsNav).toBeTruthy();
    expect(within(sectionsNav).getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(within(sectionsNav).getByRole("link", { name: "About" })).toBeTruthy();
    expect(within(sectionsNav).getByRole("link", { name: "Currencies" })).toBeTruthy();
    expect(screen.getByText("Appearance page")).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Finance")).toBeTruthy();
  });

  it("switches sections without leaving the dialog", async () => {
    const router = await renderSettingsModal("/settings/appearance");

    const sectionsNav = await screen.findByRole("navigation", { name: "Settings sections" });
    fireEvent.click(within(sectionsNav).getByRole("link", { name: "Currencies" }));

    expect(await screen.findByText("Currencies page")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings/currencies");

    const breadcrumbs = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(within(breadcrumbs).getByText("Currencies")).toBeTruthy();
  });

  it("returns to the previous app screen when closed", async () => {
    const router = await renderSettingsModal("/dashboard");

    await router.navigate({ to: "/settings/appearance" });
    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
      expect(screen.getByText("Dashboard page")).toBeTruthy();
    });
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
