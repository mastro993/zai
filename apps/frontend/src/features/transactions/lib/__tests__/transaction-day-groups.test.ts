import { describe, expect, it } from "vitest";

import { formatCurrencyFromMinor } from "@/lib/currency";

import { sampleListItem } from "../../types/sample";
import {
  formatTransactionDayHeading,
  formatTransactionDayTotal,
  formatTransactionRowDate,
  groupTransactionsByDay,
  transactionDayKey,
} from "../transaction-day-groups";

const now = new Date("2026-09-01T12:00:00");

describe("transaction day groups", () => {
  it("keys a transaction to its calendar day", () => {
    expect(transactionDayKey("2026-08-30T21:15:00")).toBe("2026-08-30");
  });

  it("labels today, yesterday, and other days", () => {
    expect(formatTransactionDayHeading("2026-09-01", now)).toBe("Today");
    expect(formatTransactionDayHeading("2026-08-31", now)).toBe("Yesterday");
    expect(formatTransactionDayHeading("2026-08-30", now)).toBe("30 August");
  });

  it("includes the year when the day is not in the current year", () => {
    expect(formatTransactionDayHeading("2025-12-24", now)).toBe("24 December 2025");
  });

  it("shows the time of day on each row", () => {
    expect(formatTransactionRowDate("2026-08-30T21:15:00")).toBe("21:15");
  });

  it("nets the day's converted income and expenses", () => {
    const income = sampleListItem({
      id: "tx-in",
      transactionType: "income",
      convertedAmount: 500,
    });
    const expense = sampleListItem({
      id: "tx-out",
      transactionType: "expense",
      convertedAmount: 200,
    });

    expect(formatTransactionDayTotal([income, expense])).toBe(formatCurrencyFromMinor(300, "EUR"));
    expect(formatTransactionDayTotal([expense])).toBe(formatCurrencyFromMinor(-200, "EUR"));
    expect(
      formatTransactionDayTotal([
        sampleListItem({ id: "tx-incomplete", complete: false, convertedAmount: null }),
      ]),
    ).toBeNull();
  });

  it("groups transactions by day while keeping list order", () => {
    const salary = sampleListItem({
      id: "tx-salary",
      description: "Salary",
      transactionDate: "2026-09-01T09:00:00",
      transactionType: "income",
    });
    const coffee = sampleListItem({
      id: "tx-coffee",
      description: "Coffee",
      transactionDate: "2026-09-01T10:00:00",
      transactionType: "expense",
    });
    const dinner = sampleListItem({
      id: "tx-dinner",
      description: "Dinner",
      transactionDate: "2026-08-31T19:30:00",
      transactionType: "expense",
    });

    expect(groupTransactionsByDay([salary, coffee, dinner], now)).toEqual([
      {
        dayKey: "2026-09-01",
        heading: "Today",
        transactions: [salary, coffee],
      },
      {
        dayKey: "2026-08-31",
        heading: "Yesterday",
        transactions: [dinner],
      },
    ]);
  });
});
