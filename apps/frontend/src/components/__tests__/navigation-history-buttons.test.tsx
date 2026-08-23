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

import { NavigationHistoryButtons } from "../navigation-history-buttons";

const renderHistoryButtons = async (initialEntry = "/dashboard") => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <NavigationHistoryButtons />
        <Outlet />
      </>
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
  const appearanceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/appearance",
    component: () => <p>Appearance page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute, settingsRoute, appearanceRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

describe("NavigationHistoryButtons", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps both directions disabled at the start of history", async () => {
    await renderHistoryButtons();

    expect(screen.getByRole("button", { name: "Go back" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", true);
  });

  it("moves back and forward through in-app navigation history", async () => {
    const router = await renderHistoryButtons();

    await router.navigate({ to: "/settings" });
    await waitFor(() => {
      expect(screen.getByText("Settings page")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go back" })).toHaveProperty("disabled", false);
      expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => {
      expect(screen.getByText("Dashboard page")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go back" })).toHaveProperty("disabled", true);
      expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));
    await waitFor(() => {
      expect(screen.getByText("Settings page")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go back" })).toHaveProperty("disabled", false);
      expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", true);
    });
  });

  it("drops the forward stack after a new navigation from the middle of history", async () => {
    const router = await renderHistoryButtons();

    await router.navigate({ to: "/settings" });
    await waitFor(() => {
      expect(screen.getByText("Settings page")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => {
      expect(screen.getByText("Dashboard page")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", false);
    });

    await router.navigate({ to: "/settings/appearance" });
    await waitFor(() => {
      expect(screen.getByText("Appearance page")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go back" })).toHaveProperty("disabled", false);
      expect(screen.getByRole("button", { name: "Go forward" })).toHaveProperty("disabled", true);
    });
  });
});
