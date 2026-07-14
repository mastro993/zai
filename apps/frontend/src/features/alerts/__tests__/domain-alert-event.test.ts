import fixtures from "../../../../../../test-fixtures/domain-alert-events.json";
import { describe, expect, it } from "vitest";

import { domainAlertEventSchema } from "../types/domain-alert-event";

describe("domain alert event contract", () => {
  it("accepts shared serialized fixtures", () => {
    for (const fixture of fixtures) {
      expect(domainAlertEventSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it("rejects malformed, unknown, and future-version envelopes", () => {
    for (const fixture of [
      { version: 1, type: "created" },
      { version: 1, type: "future" },
      { version: 2, type: "stateChanged" },
      { version: 1, type: "stateChanged", alert: {} },
    ]) {
      expect(domainAlertEventSchema.safeParse(fixture).success).toBe(false);
    }
  });
});
