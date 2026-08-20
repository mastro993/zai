import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { currencyDisplaySymbol, localizeDecimalString } from "@/lib/currency";

import {
  convertedMinorFromRate,
  formatConversionRateDisplay,
  formatConversionRatePlaceholder,
} from "../transaction-write";

describe("convertedMinorFromRate", () => {
  it("keeps sub-cent JPY to EUR rates instead of rounding to 0.01", () => {
    expect(convertedMinorFromRate(1000, "JPY", "EUR", "0.005362")).toBe(536);
  });
});

describe("formatConversionRateDisplay", () => {
  it("rounds to six fractional digits", () => {
    expect(formatConversionRateDisplay("0.00536193")).toBe(localizeDecimalString("0.005362"));
    expect(formatConversionRateDisplay("0.00536149")).toBe(localizeDecimalString("0.005361"));
    expect(formatConversionRateDisplay("0.9999995")).toBe("1");
  });

  it("keeps rates that already fit in six fractional digits", () => {
    expect(formatConversionRateDisplay("0.089568")).toBe(localizeDecimalString("0.089568"));
    expect(formatConversionRateDisplay("0.92")).toBe(localizeDecimalString("0.92"));
    expect(formatConversionRateDisplay("1")).toBe("1");
  });
});

describe("formatConversionRatePlaceholder", () => {
  it("renders 1 source = rate target-symbol on locale date", () => {
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parseISO("2026-08-20"));

    expect(formatConversionRatePlaceholder("SEK", "EUR", "0.089568", "2026-08-20")).toBe(
      `1 SEK = ${localizeDecimalString("0.089568")} ${currencyDisplaySymbol("EUR")} on ${dateLabel}`,
    );
  });

  it("rounds JPY sub-cent digits to six places in the placeholder", () => {
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parseISO("2026-08-20"));

    expect(formatConversionRatePlaceholder("JPY", "EUR", "0.00536193", "2026-08-20")).toBe(
      `1 JPY = ${localizeDecimalString("0.005362")} ${currencyDisplaySymbol("EUR")} on ${dateLabel}`,
    );
  });
});
