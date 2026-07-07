import { describe, expect, it } from "vitest";

import {
  combineDateTime,
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
