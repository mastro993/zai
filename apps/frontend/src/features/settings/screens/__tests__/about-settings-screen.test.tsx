// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toaster/toast";

import {
  ABOUT_APP_IDENTIFIER,
  ABOUT_APP_VERSION,
  ABOUT_LICENSE,
  ABOUT_RELEASE_CHANNEL,
  ABOUT_TAURI_VERSION,
  UPDATE_CHECK_UNAVAILABLE_MESSAGE,
} from "../../lib/about-info";
import { AboutSettingsScreen } from "../about-settings-screen";

describe("AboutSettingsScreen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders version, channel, build facts, and a mock update check", () => {
    render(<AboutSettingsScreen />);

    expect(screen.getByRole("heading", { name: "About" })).toBeTruthy();
    expect(screen.getByText("Updates")).toBeTruthy();
    expect(screen.getByText("Build")).toBeTruthy();
    expect(screen.getByText(`Version ${ABOUT_APP_VERSION}`)).toBeTruthy();
    expect(screen.getByText(ABOUT_RELEASE_CHANNEL)).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText(ABOUT_TAURI_VERSION)).toBeTruthy();
    expect(screen.getByText(ABOUT_APP_IDENTIFIER)).toBeTruthy();
    expect(screen.getByText(ABOUT_LICENSE)).toBeTruthy();
    expect(screen.getByText(UPDATE_CHECK_UNAVAILABLE_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeTruthy();
  });

  it("shows that update checks are not available when the mock button is pressed", () => {
    const info = vi.spyOn(toast, "info").mockReturnValue("toast-id");

    render(<AboutSettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(info).toHaveBeenCalledWith(UPDATE_CHECK_UNAVAILABLE_MESSAGE);
  });
});
