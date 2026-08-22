// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { settingsSearchSchema } from "@/features/settings/types/settings-search";
import { redirectFromSettingsIndex } from "@/features/settings/lib/settings-index-redirect";

describe("settings search", () => {
  it("keeps focus=currencies when sibling keys are undefined", () => {
    expect(settingsSearchSchema.parse({ focus: "currencies", leftover: undefined })).toEqual({
      focus: "currencies",
    });
  });

  it("renders currencies settings for ?focus=currencies without a search error", async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });
    const settingsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/settings",
      component: () => <Outlet />,
    });
    const currenciesRoute = createRoute({
      getParentRoute: () => settingsRoute,
      path: "currencies",
      validateSearch: settingsSearchSchema,
      component: function CurrenciesSearchProbe() {
        const search = currenciesRoute.useSearch();
        return <p>{search.focus ?? "none"}</p>;
      },
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([settingsRoute.addChildren([currenciesRoute])]),
      history: createMemoryHistory({ initialEntries: ["/settings/currencies?focus=currencies"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("currencies")).toBeTruthy();
    expect(screen.queryByText("Something went wrong!")).toBeNull();
  });

  it("redirects settings home to appearance", async () => {
    const router = createSettingsRedirectRouter("/settings");
    await router.load();
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("appearance")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings/appearance");
  });

  it("redirects focus search onto the currencies section", async () => {
    const router = createSettingsRedirectRouter("/settings?focus=rates");
    await router.load();
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("rates")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/settings/currencies");
  });
});

function createSettingsRedirectRouter(initialEntry: string) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <Outlet />,
  });
  const settingsIndexRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/",
    validateSearch: settingsSearchSchema,
    beforeLoad: ({ search }) => {
      throw redirectFromSettingsIndex(search);
    },
  });
  const appearanceRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "appearance",
    component: () => <p>appearance</p>,
  });
  const currenciesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "currencies",
    validateSearch: settingsSearchSchema,
    component: function CurrenciesSearchProbe() {
      const search = currenciesRoute.useSearch();
      return <p>{search.focus ?? "none"}</p>;
    },
  });

  return createRouter({
    routeTree: rootRoute.addChildren([
      settingsRoute.addChildren([settingsIndexRoute, appearanceRoute, currenciesRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}
