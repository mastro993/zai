import { describe, expect, it } from "vitest";

import { localeSuggestedCurrency } from "../lib/locale-suggested-currency";

const supported = new Set(["EUR", "USD", "GBP", "JPY"]);

describe("localeSuggestedCurrency", () => {
  it("maps a US locale to USD and labels it as a guess, not a confirmed choice", () => {
    expect(localeSuggestedCurrency("en-US", supported)).toBe("USD");
  });

  it("falls back to EUR when the region currency is unsupported", () => {
    expect(localeSuggestedCurrency("th-TH", supported)).toBe("EUR");
  });
});
