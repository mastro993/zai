import { describe, expect, it } from "vitest";

import { formatCurrencyFromMinor } from "../currency";

describe("currency helpers", () => {
  it("formats minor units as EUR currency", () => {
    const eurFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    expect(formatCurrencyFromMinor(1234, "EUR")).toBe(eurFormatter.format(12.34));
    expect(formatCurrencyFromMinor(100, "EUR")).toBe(eurFormatter.format(1));
  });

  it("formats minor units using provided currency", () => {
    const usdFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    expect(formatCurrencyFromMinor(1234, "USD")).toBe(usdFormatter.format(12.34));
  });

  it("keeps negative minor units signed", () => {
    const eurFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    expect(formatCurrencyFromMinor(-1234, "EUR")).toBe(eurFormatter.format(-12.34));
  });
});
