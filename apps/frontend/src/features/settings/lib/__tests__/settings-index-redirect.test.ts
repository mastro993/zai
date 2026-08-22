import { describe, expect, it } from "vitest";

import { redirectFromSettingsIndex } from "../settings-index-redirect";

describe("redirectFromSettingsIndex", () => {
  it("always redirects away from the settings index", () => {
    expect(() => redirectFromSettingsIndex({})).toThrow();
    expect(() => redirectFromSettingsIndex({ focus: "currencies" })).toThrow();
    expect(() => redirectFromSettingsIndex({ focus: "rates" })).toThrow();
  });
});
