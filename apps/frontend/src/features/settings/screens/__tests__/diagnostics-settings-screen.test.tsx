// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetCommandTransports, setCommandTransports } from "@/commands/shared";
import type { CommandTransport } from "@/commands/types";

import { DIAGNOSTICS_COMMANDS } from "../../commands/registry";
import type { Diagnostics } from "../../types/diagnostics";
import { DiagnosticsSettingsScreen } from "../diagnostics-settings-screen";

const diagnostics: Diagnostics = {
  operatingSystem: "macos",
  architecture: "aarch64",
  database: {
    path: "/tmp/zai.db",
    sizeBytes: 1_536,
    schemaVersion: "202608280000000001",
  },
  logs: {
    path: "/tmp/zai-logs",
    sizeBytes: 3_072,
  },
};

const invokeMock = vi.fn();
const fakeTransport = (): CommandTransport => ({ invoke: invokeMock });

describe("DiagnosticsSettingsScreen", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (descriptor) =>
      descriptor.name === "get_diagnostics" ? diagnostics : undefined,
    );
    setCommandTransports({ tauri: fakeTransport(), web: fakeTransport() });
  });

  afterEach(() => {
    cleanup();
    resetCommandTransports();
    vi.unstubAllEnvs();
  });

  it("shows desktop database and log diagnostics with bounded folder actions", async () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");

    render(<DiagnosticsSettingsScreen />);

    expect(await screen.findByText("/tmp/zai.db")).toBeTruthy();
    expect(screen.getByText("1.5 KB")).toBeTruthy();
    expect(screen.getByText("3 KB")).toBeTruthy();
    expect(screen.getByText("202608280000000001")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Show logs in folder" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show database in folder" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        DIAGNOSTICS_COMMANDS.show_database_in_folder,
        undefined,
      ),
    );
  });

  it("reports persistent logs as unconfigured in web mode", async () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
    invokeMock.mockImplementation(async (descriptor) =>
      descriptor.name === "get_diagnostics" ? { ...diagnostics, logs: null } : undefined,
    );

    render(<DiagnosticsSettingsScreen />);

    expect(await screen.findByText("Not configured")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show database in folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show logs in folder" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy database path" })).toBeTruthy();
  });
});
