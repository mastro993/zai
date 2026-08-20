import { describe, expect, it } from "vitest";

import {
  currencyDisplaySymbol,
  formatCurrencyFromMinor,
  isoFractionDigits,
  localizeDecimalString,
} from "../currency";

describe("currency helpers", () => {
  it("formats minor units as EUR currency", () => {
    const eurFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "narrowSymbol",
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
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    expect(formatCurrencyFromMinor(1234, "USD")).toBe(usdFormatter.format(12.34));
  });

  it("uses the currency sign instead of the ISO code", () => {
    const withSign = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(56);
    const withCode = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(56);

    expect(formatCurrencyFromMinor(5600, "USD")).toBe(withSign);
    expect(formatCurrencyFromMinor(5600, "USD")).not.toBe(withCode);
  });

  it("uses ISO minor-unit digits instead of dividing by 100", () => {
    expect(isoFractionDigits("JPY")).toBe(0);
    expect(isoFractionDigits("BHD")).toBe(3);

    const jpyFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "JPY",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const bhdFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "BHD",
      currencyDisplay: "narrowSymbol",
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
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    expect(formatCurrencyFromMinor(-1234, "EUR")).toBe(eurFormatter.format(-12.34));
  });

  it("returns the locale currency symbol", () => {
    const symbol = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;

    expect(currencyDisplaySymbol("EUR")).toBe(symbol);
  });

  it("localizes a decimal string without rounding", () => {
    const decimalSeparator =
      new Intl.NumberFormat(undefined).formatToParts(1.1).find((part) => part.type === "decimal")
        ?.value ?? ".";

    expect(localizeDecimalString("0.089568")).toBe(`0${decimalSeparator}089568`);
  });
});
