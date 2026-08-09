import { describe, expect, it, vi } from "vitest";

import {
  SIDEBAR_PREFERENCE_STORAGE_KEY,
  SIDEBAR_PREFERENCE_VERSION,
  readSidebarOpen,
  writeSidebarOpen,
} from "../sidebar-preference";

const createStorage = (value: string | null = null) => ({
  getItem: vi.fn(() => value),
  setItem: vi.fn(),
});

describe("sidebar preference", () => {
  it("defaults to expanded when preference is missing or invalid", () => {
    expect(readSidebarOpen(createStorage())).toBe(true);
    expect(readSidebarOpen(createStorage("not json"))).toBe(true);
    expect(readSidebarOpen(createStorage(JSON.stringify({ version: 2, open: false })))).toBe(true);
    expect(readSidebarOpen(createStorage(JSON.stringify({ version: 1, open: "no" })))).toBe(true);
  });

  it("reads the validated versioned preference", () => {
    expect(readSidebarOpen(createStorage(JSON.stringify({ version: 1, open: false })))).toBe(false);
  });

  it("writes only local preference data", () => {
    const storage = createStorage();

    writeSidebarOpen(false, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      SIDEBAR_PREFERENCE_STORAGE_KEY,
      JSON.stringify({ version: SIDEBAR_PREFERENCE_VERSION, open: false }),
    );
  });
});
