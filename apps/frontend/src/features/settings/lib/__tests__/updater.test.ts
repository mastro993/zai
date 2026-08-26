// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  isUpdaterAvailable,
  readUpdateChannel,
  updaterManifestTarget,
  writeUpdateChannel,
  type UpdateChannelStorage,
} from "../updater";

const memoryStorage = (initialValue: string | null = null): UpdateChannelStorage => {
  let value = initialValue;
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue;
    },
  };
};

describe("updater settings", () => {
  it("defaults to stable and persists a valid channel", () => {
    const storage = memoryStorage();

    expect(readUpdateChannel(storage)).toBe("stable");
    expect(writeUpdateChannel("nightly", storage)).toBe(true);
    expect(readUpdateChannel(storage)).toBe("nightly");
    expect(readUpdateChannel(memoryStorage("preview"))).toBe("stable");
  });

  it("enables only stamped desktop builds and routes channel manifests", () => {
    expect(isUpdaterAvailable("tauri", "2026.8.25001", "macos-aarch64")).toBe(true);
    expect(isUpdaterAvailable("tauri", "0.0.0-dev", "macos-aarch64")).toBe(false);
    expect(isUpdaterAvailable("web", "2026.8.25001", "macos-aarch64")).toBe(false);
    expect(updaterManifestTarget("nightly", "linux-x86_64")).toBe("nightly-linux-x86_64");
  });
});
