import { describe, expect, it } from "vitest";

import {
  combineDateTime,
  formatAmountFromMinor,
  isPartialAmountInput,
  normalizeAmountInput,
  prepareAmountForValidation,
  splitDateTime,
  toBackendDateTime,
  toDateTimeInputValue,
} from "../transaction";

describe("transaction date helpers", () => {
  it("splits a datetime-local value into date and time", () => {
    expect(splitDateTime("2026-07-07T14:30")).toEqual({
      date: "2026-07-07",
      time: "14:30",
    });
  });

  it("defaults missing time to midnight", () => {
    expect(splitDateTime("2026-07-07")).toEqual({
      date: "2026-07-07",
      time: "00:00",
    });
  });

  it("combines date and time into datetime-local format", () => {
    expect(combineDateTime("2026-07-07", "14:30")).toBe("2026-07-07T14:30");
  });

  it("round-trips through split and combine", () => {
    const value = "2026-07-07T09:15";
    const { date, time } = splitDateTime(value);

    expect(combineDateTime(date, time)).toBe(value);
  });

  it("normalizes backend datetime values for the form", () => {
    expect(toDateTimeInputValue("2026-07-07T09:15:00")).toBe("2026-07-07T09:15");
    expect(toBackendDateTime("2026-07-07T09:15")).toBe("2026-07-07T09:15:00");
  });
});

describe("transaction amount helpers", () => {
  it("formats minor units for decimal input", () => {
    expect(formatAmountFromMinor(1234)).toBe("12.34");
    expect(formatAmountFromMinor(100)).toBe("1.00");
    expect(formatAmountFromMinor(0)).toBe("0.00");
  });

  it("prepares leading-dot amounts for validation", () => {
    expect(prepareAmountForValidation(".00")).toBe("0.00");
    expect(prepareAmountForValidation("0")).toBe("0");
  });

  it("normalizes complete amount input on blur", () => {
    expect(normalizeAmountInput("0")).toBe("0.00");
    expect(normalizeAmountInput(".00")).toBe("0.00");
    expect(normalizeAmountInput("12")).toBe("12.00");
  });

  it("accepts partial decimal input while typing", () => {
    expect(isPartialAmountInput("12.")).toBe(true);
    expect(isPartialAmountInput("12,3")).toBe(true);
    expect(isPartialAmountInput("12.34")).toBe(true);
    expect(isPartialAmountInput("12.345")).toBe(false);
    expect(isPartialAmountInput("abc")).toBe(false);
  });
});
