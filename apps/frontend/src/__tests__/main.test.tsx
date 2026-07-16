// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const createRootMock = vi.hoisted(() => vi.fn(() => ({ render: renderMock })));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: isTauriMock,
}));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../router", () => ({
  getRouter: vi.fn(() => ({})),
}));

describe("app bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
    isTauriMock.mockReset();
    createRootMock.mockClear();
    renderMock.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("does not start the router when a Tauri build is opened outside Tauri", async () => {
    isTauriMock.mockReturnValue(false);

    await import("../main");

    expect(createRootMock).not.toHaveBeenCalled();
    expect(document.getElementById("root")?.textContent).toContain(
      "This desktop frontend must be opened by Tauri",
    );
  });
});
