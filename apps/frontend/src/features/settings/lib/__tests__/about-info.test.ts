import { describe, expect, it } from "vitest";

import {
  resolveAboutAppVersion,
  resolveAboutBuildMode,
  resolveAboutReleaseChannel,
} from "../about-info";

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
  });
});

describe("resolveAboutReleaseChannel", () => {
  it("labels unstamped builds as Dev", () => {
    expect(resolveAboutReleaseChannel("0.0.0-dev")).toBe("Dev");
  });

  it("labels beta and stable ships", () => {
    expect(resolveAboutReleaseChannel("2026.8.24-beta.0")).toBe("Beta");
    expect(resolveAboutReleaseChannel("2026.8.24")).toBe("Stable");
  });
});
