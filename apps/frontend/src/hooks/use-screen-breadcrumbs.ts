import { useRouterState } from "@tanstack/react-router";

import { useSettingsReturnHrefValue } from "@/features/settings/hooks/use-settings-return-href";
import { isSettingsPath, resolveScreenBreadcrumbs } from "@/lib/navigation";

export const useScreenBreadcrumbs = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnHref = useSettingsReturnHrefValue();
  const path = isSettingsPath(pathname) ? returnHref : pathname;

  return resolveScreenBreadcrumbs(path);
};
