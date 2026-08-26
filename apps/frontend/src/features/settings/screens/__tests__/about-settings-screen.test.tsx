// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ABOUT_APP_IDENTIFIER, ABOUT_LICENSE, ABOUT_TAURI_VERSION } from "../../lib/about-info";
import { AboutSettingsScreen } from "../about-settings-screen";

describe("AboutSettingsScreen", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders disabled updater controls in development builds", () => {
    render(<AboutSettingsScreen />);

    expect(screen.queryByRole("heading", { name: "About" })).toBeNull();
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("Update channel")).toBeTruthy();
    expect(screen.getByText("Stable")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText(ABOUT_TAURI_VERSION)).toBeTruthy();
    expect(screen.getByText(ABOUT_APP_IDENTIFIER)).toBeTruthy();
    expect(screen.getByText(ABOUT_LICENSE)).toBeTruthy();
    expect(screen.getByText("Update checks are disabled in development builds.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check for updates" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows release versions and enables production update checks", () => {
    vi.stubEnv("VITE_ZAI_APP_VERSION", "2026.8.24001");
    vi.stubEnv("VITE_ZAI_UPDATER_TARGET", "macos-aarch64");

    render(<AboutSettingsScreen />);

    expect(screen.getByText("2026.8.24.1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check for updates" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByText("Checks stable releases when Zai starts.")).toBeTruthy();
  });

  it("hides updater controls in web mode", () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");

    render(<AboutSettingsScreen />);

    expect(screen.queryByText("Update channel")).toBeNull();
    expect(screen.queryByRole("button", { name: "Check for updates" })).toBeNull();
  });
});
