import { createContext, useContext, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { isSettingsPath } from "@/lib/navigation";

const DEFAULT_RETURN_HREF = "/dashboard";

const SettingsReturnHrefContext = createContext<string | null>(null);

export function useSettingsReturnHref(pathname: string): string {
  const returnHrefRef = useRef(DEFAULT_RETURN_HREF);

  if (!isSettingsPath(pathname)) {
    returnHrefRef.current = pathname.length > 0 ? pathname : DEFAULT_RETURN_HREF;
  }

  return returnHrefRef.current;
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
