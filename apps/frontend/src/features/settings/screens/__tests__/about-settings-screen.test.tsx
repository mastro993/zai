// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toaster/toast";

import {
  ABOUT_APP_IDENTIFIER,
  ABOUT_LICENSE,
  ABOUT_TAURI_VERSION,
  UPDATE_CHECK_UNAVAILABLE_MESSAGE,
} from "../../lib/about-info";
import { AboutSettingsScreen } from "../about-settings-screen";

describe("AboutSettingsScreen", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders version, channel, build facts, and a mock update check", () => {
    render(<AboutSettingsScreen />);

    expect(screen.queryByRole("heading", { name: "About" })).toBeNull();
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("Release channel")).toBeTruthy();
    expect(screen.getByText("Dev")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText(ABOUT_TAURI_VERSION)).toBeTruthy();
    expect(screen.getByText(ABOUT_APP_IDENTIFIER)).toBeTruthy();
    expect(screen.getByText(ABOUT_LICENSE)).toBeTruthy();
    expect(screen.getByText(UPDATE_CHECK_UNAVAILABLE_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeTruthy();
  });

  it("shows the Beta channel for a stamped beta version", () => {
    vi.stubEnv("VITE_ZAI_APP_VERSION", "2026.8.24-beta.0");

    render(<AboutSettingsScreen />);

    expect(screen.getByText("2026.8.24-beta.0")).toBeTruthy();
    expect(screen.getByText("Release channel")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("shows the Stable channel for a stamped stable version", () => {
    vi.stubEnv("VITE_ZAI_APP_VERSION", "2026.8.24");

    render(<AboutSettingsScreen />);

    expect(screen.getByText("2026.8.24")).toBeTruthy();
    expect(screen.getByText("Stable")).toBeTruthy();
  });

  it("shows that update checks are not available when the mock button is pressed", () => {
    const info = vi.spyOn(toast, "info").mockReturnValue("toast-id");

    render(<AboutSettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(info).toHaveBeenCalledWith(UPDATE_CHECK_UNAVAILABLE_MESSAGE);
  });
});
