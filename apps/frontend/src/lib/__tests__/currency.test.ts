import { describe, expect, it } from "vitest";

import { formatCurrencyFromMinor, isoFractionDigits } from "../currency";

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

  it("uses ISO minor-unit digits instead of dividing by 100", () => {
    expect(isoFractionDigits("JPY")).toBe(0);
    expect(isoFractionDigits("BHD")).toBe(3);

    const jpyFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const bhdFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "BHD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });

    expect(formatCurrencyFromMinor(1234, "JPY")).toBe(jpyFormatter.format(1234));
    expect(formatCurrencyFromMinor(1234, "BHD")).toBe(bhdFormatter.format(1.234));
  });

  it("falls back to 2 digits for an unknown currency code", () => {
    expect(isoFractionDigits("ZZZ")).toBe(2);
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
