import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { currencyDisplaySymbol, localizeDecimalString } from "@/lib/currency";

import { formatConversionRatePlaceholder } from "../transaction-write";

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
});
