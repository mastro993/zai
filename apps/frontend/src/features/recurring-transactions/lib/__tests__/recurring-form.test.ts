import { describe, expect, it } from "vitest";

import { formatRecurringOrdinal, getScheduleIntervalUnitItems } from "../recurring-form";

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
