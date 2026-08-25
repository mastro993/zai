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
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsReturnHrefProvider } from "../../hooks/use-settings-return-href";
import { SettingsModalProvider, useOpenSettings } from "../../hooks/use-settings-modal";
import { SettingsModal } from "../settings-modal";

const dashboardMounted = vi.fn();

function DashboardPage() {
  const [value, setValue] = useState("");

  useEffect(() => {
    dashboardMounted();
  }, []);

  return (
    <label>
      Dashboard state
      <input value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
}

function OpenSettingsButton() {
  const openSettings = useOpenSettings();

  return (
    <button type="button" onClick={() => openSettings()}>
      Open settings
    </button>
  );
}

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
    component: DashboardPage,
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

const renderSettingsOverlay = async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <SettingsModalProvider>
        <OpenSettingsButton />
        <Outlet />
      </SettingsModalProvider>
    ),
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: DashboardPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute]),
    history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("SettingsModal", () => {
  afterEach(() => {
    cleanup();
    dashboardMounted.mockClear();
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
    const sidebarHeader = document.querySelector('[data-slot="settings-modal-sidebar-header"]');
    const sidebarFooter = document.querySelector('[data-slot="settings-modal-sidebar-footer"]');
    const title = screen.getByRole("heading", { name: "Settings" });
    const backButton = screen.getByRole("button", { name: "Back to app" });
    const sectionsNav = screen.getByRole("navigation", { name: "Settings sections" });

    expect(sidebar).not.toBeNull();
    expect(sidebarHeader).not.toBeNull();
    expect(sidebarFooter).not.toBeNull();
    expect(document.querySelector('[data-slot="settings-modal-header"]')).toBeNull();
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(sidebar?.contains(title)).toBe(true);
    expect(sidebarHeader?.contains(title)).toBe(true);
    expect(sidebarHeader?.contains(backButton)).toBe(false);
    expect(sidebarFooter?.contains(backButton)).toBe(true);

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
  });

  it("returns to the previous app screen when closed", async () => {
    const router = await renderSettingsModal("/dashboard");

    await router.navigate({ to: "/settings/appearance" });
    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to app" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
      expect(screen.getByRole("textbox", { name: "Dashboard state" })).toBeTruthy();
    });
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("preserves the current screen while settings is open", async () => {
    const router = await renderSettingsOverlay();
    const input = screen.getByRole("textbox", { name: "Dashboard state" });
    fireEvent.change(input, { target: { value: "preserved" } });

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/dashboard");

    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(await screen.findByText("App version")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Back to app" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    });
    expect(screen.getByRole("textbox", { name: "Dashboard state" })).toHaveProperty(
      "value",
      "preserved",
    );
    expect(dashboardMounted).toHaveBeenCalledTimes(1);
  });
});
