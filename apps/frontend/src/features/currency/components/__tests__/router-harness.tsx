import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";

const HarnessChildrenContext = createContext<ReactNode>(null);

function RootLayout() {
  return <Outlet />;
}

function IndexPage() {
  return useContext(HarnessChildrenContext);
}

export function RouterHarness({ children }: { children: ReactNode }) {
  const [router] = useState(() => {
    const rootRoute = createRootRoute({
      component: RootLayout,
    });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: IndexPage,
    });
    return createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });

  return (
    <HarnessChildrenContext.Provider value={children}>
      <RouterProvider router={router} />
    </HarnessChildrenContext.Provider>
  );
}
