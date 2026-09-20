import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { isSettingsPath } from "@/lib/navigation";

const DEFAULT_RETURN_HREF = "/dashboard";

const SettingsReturnHrefContext = createContext<string | null>(null);

export function useSettingsReturnHref(pathname: string): string {
  const [returnHref, setReturnHref] = useState(DEFAULT_RETURN_HREF);

  if (!isSettingsPath(pathname) && pathname.length > 0 && pathname !== returnHref) {
    setReturnHref(pathname);
  }

  return returnHref;
}

export function SettingsReturnHrefProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const href = useSettingsReturnHref(pathname);

  return (
    <SettingsReturnHrefContext.Provider value={href}>{children}</SettingsReturnHrefContext.Provider>
  );
}

export function useSettingsReturnHrefValue(): string {
  return useContext(SettingsReturnHrefContext) ?? DEFAULT_RETURN_HREF;
}
