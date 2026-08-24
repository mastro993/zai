import { describe, expect, it } from "vitest";

import { resolveAboutBuildMode } from "../about-info";

describe("resolveAboutBuildMode", () => {
  it("labels production and development builds", () => {
    expect(resolveAboutBuildMode(true)).toBe("Production");
    expect(resolveAboutBuildMode(false)).toBe("Development");
  });
});
