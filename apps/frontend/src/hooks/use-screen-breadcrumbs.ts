import { useRouterState } from "@tanstack/react-router";

import { resolveScreenBreadcrumbs } from "@/lib/navigation";

export const useScreenBreadcrumbs = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return resolveScreenBreadcrumbs(pathname);
};
