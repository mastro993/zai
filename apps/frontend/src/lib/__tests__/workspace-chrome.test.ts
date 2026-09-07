import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceChrome,
  settingsLocation,
  shouldPersistSidebarOpen,
  sidebarOpenForChrome,
} from "../workspace-chrome";

const appChrome = resolveWorkspaceChrome({ pathname: "/dashboard", returnTo: "/dashboard" });
const settingsChrome = resolveWorkspaceChrome({
  pathname: "/settings/appearance",
  returnTo: "/cash-flow",
});

describe("resolveWorkspaceChrome", () => {
  it("maps app paths to app chrome without returnTo", () => {
    expect(appChrome).toEqual({ kind: "app" });
    expect("returnTo" in appChrome).toBe(false);
  });

  it("maps settings paths to settings chrome with returnTo", () => {
    expect(settingsChrome).toEqual({
      kind: "settings",
      returnTo: "/cash-flow",
    });
  });
});

describe("sidebar occupancy helpers", () => {
  it("forces settings open and ignores the stored preference", () => {
    expect(sidebarOpenForChrome(settingsChrome, false)).toBe(true);
    expect(sidebarOpenForChrome(settingsChrome, true)).toBe(true);
    expect(shouldPersistSidebarOpen(settingsChrome)).toBe(false);
  });

  it("keeps the app preference and persists it", () => {
    expect(sidebarOpenForChrome(appChrome, false)).toBe(false);
    expect(sidebarOpenForChrome(appChrome, true)).toBe(true);
    expect(shouldPersistSidebarOpen(appChrome)).toBe(true);
  });
});

describe("settingsLocation", () => {
  it("sends appearance and omitted section to the settings index", () => {
    expect(settingsLocation()).toEqual({ to: "/settings" });
    expect(settingsLocation({ section: "appearance" })).toEqual({ to: "/settings" });
  });

  it("maps named sections and keeps currencies focus even when unset", () => {
    expect(settingsLocation({ section: "about" })).toEqual({ to: "/settings/about" });
    expect(settingsLocation({ section: "diagnostics" })).toEqual({ to: "/settings/diagnostics" });
    expect(settingsLocation({ section: "currencies" })).toEqual({
      to: "/settings/currencies",
      search: { focus: undefined },
    });
    expect(settingsLocation({ section: "currencies", focus: "rates" })).toEqual({
      to: "/settings/currencies",
      search: { focus: "rates" },
    });
  });
});
