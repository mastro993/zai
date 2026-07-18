import { describe, expect, it } from "vitest";

import {
  TRANSACTION_TYPE_DISPLAY,
  formatTransactionTypeLabel,
  isTransactionType,
} from "../transaction-type-display";

describe("transaction-type-display", () => {
  it("labels income and expense", () => {
    expect(formatTransactionTypeLabel("income")).toBe("Income");
    expect(formatTransactionTypeLabel("expense")).toBe("Expense");
  });

  it("maps types to badge variants", () => {
    expect(TRANSACTION_TYPE_DISPLAY.income.badgeVariant).toBe("default");
    expect(TRANSACTION_TYPE_DISPLAY.expense.badgeVariant).toBe("destructive");
  });

  it("narrows known transaction types", () => {
    expect(isTransactionType("income")).toBe(true);
    expect(isTransactionType("expense")).toBe(true);
    expect(isTransactionType("transfer")).toBe(false);
  });
});
