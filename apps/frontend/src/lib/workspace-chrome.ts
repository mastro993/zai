import { useRouterState } from "@tanstack/react-router";

import { useSettingsReturnHrefValue } from "@/features/settings/hooks/use-settings-return-href";
import { isSettingsPath } from "@/lib/navigation";

export type WorkspaceChrome = { kind: "app" } | { kind: "settings"; returnTo: string };

export type SettingsSection = "appearance" | "about" | "diagnostics" | "currencies";
export type SettingsFocus = "rates" | "currencies";

export interface OpenSettingsOptions {
  section?: SettingsSection;
  focus?: SettingsFocus;
}

export interface ResolveWorkspaceChromeInput {
  pathname: string;
  returnTo: string;
}

export function resolveWorkspaceChrome({
  pathname,
  returnTo,
}: ResolveWorkspaceChromeInput): WorkspaceChrome {
  if (isSettingsPath(pathname)) {
    return { kind: "settings", returnTo };
  }

  return { kind: "app" };
}

export function sidebarOpenForChrome(chrome: WorkspaceChrome, preference: boolean): boolean {
  switch (chrome.kind) {
    case "settings":
      return true;
    case "app":
      return preference;
    default: {
      const impossible: never = chrome;
      return impossible;
    }
  }
}

export function shouldPersistSidebarOpen(chrome: WorkspaceChrome): boolean {
  switch (chrome.kind) {
    case "settings":
      return false;
    case "app":
      return true;
    default: {
      const impossible: never = chrome;
      return impossible;
    }
  }
}

export function settingsLocation(options: OpenSettingsOptions = {}) {
  const section = options.section ?? "appearance";

  switch (section) {
    case "about":
      return { to: "/settings/about" as const };
    case "diagnostics":
      return { to: "/settings/diagnostics" as const };
    case "currencies":
      return { to: "/settings/currencies" as const, search: { focus: options.focus } };
    case "appearance":
      return { to: "/settings" as const };
    default: {
      const impossible: never = section;
      return impossible;
    }
  }
}

export function useWorkspaceChrome(): WorkspaceChrome {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnTo = useSettingsReturnHrefValue();

  return resolveWorkspaceChrome({ pathname, returnTo });
}
