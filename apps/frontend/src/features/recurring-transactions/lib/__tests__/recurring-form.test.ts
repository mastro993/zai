import { afterEach, describe, expect, it } from "vitest";

import {
  resetLastUsedTransactionCurrency,
  setLastUsedTransactionCurrency,
} from "@/features/transactions/lib/last-used-currency";

import {
  createRecurringFormDefaults,
  formatRecurringOrdinal,
  getScheduleIntervalUnitItems,
} from "../recurring-form";

afterEach(() => {
  resetLastUsedTransactionCurrency();
});

describe("recurring form schedule labels", () => {
  it("pluralizes schedule units except for exactly one", () => {
    expect(getScheduleIntervalUnitItems("1")).toEqual([
      { value: "day", label: "day" },
      { value: "week", label: "week" },
      { value: "month", label: "month" },
      { value: "year", label: "year" },
    ]);
    expect(getScheduleIntervalUnitItems("2")[2]).toEqual({
      value: "month",
      label: "months",
    });
    expect(getScheduleIntervalUnitItems("")[0].label).toBe("days");
  });

  it("formats every monthly day as an ordinal", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(formatRecurringOrdinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });
});

describe("recurring form money defaults", () => {
  it("preselects last-used currency when it is still enabled", () => {
    setLastUsedTransactionCurrency("USD");
    expect(createRecurringFormDefaults("EUR", ["EUR", "USD"]).currency).toBe("USD");
  });

  it("falls back to the default currency when last-used is disabled", () => {
    setLastUsedTransactionCurrency("USD");
    expect(createRecurringFormDefaults("EUR", ["EUR"]).currency).toBe("EUR");
  });
});
