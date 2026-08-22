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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationSidebar } from "../application-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const stubMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const maxWidth = /max-width:\s*(\d+)/.exec(query);
      const minWidth = /min-width:\s*(\d+)/.exec(query);
      let matches = false;
      if (maxWidth) {
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

const SidebarProbe = () => (
  <SidebarProvider>
    <ApplicationSidebar buildTarget="web" />
    <Outlet />
  </SidebarProvider>
);

const renderSidebar = async (initialEntry: string) => {
  const rootRoute = createRootRoute({
    component: SidebarProbe,
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
  const currenciesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "currencies",
    component: () => <p>Currencies page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute,
      settingsRoute.addChildren([appearanceRoute, currenciesRoute]),
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps app navigation and a settings footer control on the main workspace", async () => {
    await renderSidebar("/dashboard");

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" }).hasAttribute("data-active")).toBe(false);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
  });

  it("replaces app navigation with settings sections and a back control", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));

    const back = await screen.findByRole("button", { name: "Back" });
    const appearance = screen.getByRole("link", { name: "Appearance" });
    const settings = screen.getByRole("link", { name: "Settings" });

    expect(appearance).toBeTruthy();
    expect(screen.getByRole("link", { name: "Currencies" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(settings.getAttribute("data-active")).toBe("");
    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(
      back.compareDocumentPosition(appearance) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("returns to the previous app screen from the back control", async () => {
    await renderSidebar("/dashboard");

    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("button", { name: "Back" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Dashboard page")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
