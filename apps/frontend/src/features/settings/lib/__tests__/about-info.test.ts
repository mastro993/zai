import { describe, expect, it } from "vitest";

import { resolveAboutAppVersion, resolveAboutBuildMode } from "../about-info";

describe("resolveAboutBuildMode", () => {
  it("labels production and development builds", () => {
    expect(resolveAboutBuildMode(true)).toBe("Production");
    expect(resolveAboutBuildMode(false)).toBe("Development");
  });
});

describe("resolveAboutAppVersion", () => {
  it("shows dev for the git placeholder", () => {
    expect(resolveAboutAppVersion("0.0.0-dev")).toBe("dev");
  });

  it("shows the stamped calendar version", () => {
    expect(resolveAboutAppVersion("2026.8.24-beta.0")).toBe("2026.8.24-beta.0");
    expect(resolveAboutAppVersion("2026.8.24")).toBe("2026.8.24");
    expect(resolveAboutAppVersion("2026.8.24001")).toBe("2026.8.24.1");
  });
});
