// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    const header = document.querySelector('[data-slot="settings-modal-header"]');
    const title = screen.getByRole("heading", { name: "Settings" });
    expect(header).not.toBeNull();
    expect(header?.className).toContain("h-12");
    expect(header?.className).toContain("border-b");
    expect(header?.contains(title)).toBe(true);
    expect(document.querySelector("aside")?.contains(title)).toBe(false);

    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Currencies" })).toBeTruthy();
    expect(screen.getByText("Appearance page")).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Finance")).toBeTruthy();
  });

  it("switches sections without leaving the dialog", async () => {
    const router = await renderSettingsModal("/settings/appearance");

    fireEvent.click(await screen.findByRole("link", { name: "Currencies" }));

    expect(await screen.findByText("Currencies page")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings/currencies");
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
