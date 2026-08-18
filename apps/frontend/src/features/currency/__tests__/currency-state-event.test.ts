import fixtures from "../../../../../../test-fixtures/currency-state-events.json";
import { describe, expect, it } from "vitest";

import { currencyStateEventSchema } from "../types/currency-state-event";

describe("currency-state event contract", () => {
  it("accepts shared serialized fixtures", () => {
    for (const fixture of fixtures) {
      expect(currencyStateEventSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it("rejects malformed, unknown, and future-version envelopes", () => {
    for (const fixture of [
      { version: 1, type: "started" },
      { version: 1, type: "future" },
      { version: 2, type: "stateChanged" },
      { version: 1, type: "stateChanged", jobId: "job-1" },
    ]) {
      expect(currencyStateEventSchema.safeParse(fixture).success).toBe(false);
    }
  });
});
