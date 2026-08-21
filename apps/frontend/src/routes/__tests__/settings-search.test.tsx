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

import { settingsSearchSchema } from "../settings";

describe("settings search", () => {
  it("keeps focus=currencies when sibling keys are undefined", () => {
    expect(settingsSearchSchema.parse({ focus: "currencies", leftover: undefined })).toEqual({
      focus: "currencies",
    });
  });

  it("renders settings for ?focus=currencies without a search error", async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });
    const settingsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/settings",
      validateSearch: settingsSearchSchema,
      component: function SettingsSearchProbe() {
        const search = settingsRoute.useSearch();
        return <p>{search.focus ?? "none"}</p>;
      },
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([settingsRoute]),
      history: createMemoryHistory({ initialEntries: ["/settings?focus=currencies"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("currencies")).toBeTruthy();
    expect(screen.queryByText("Something went wrong!")).toBeNull();
  });
});
