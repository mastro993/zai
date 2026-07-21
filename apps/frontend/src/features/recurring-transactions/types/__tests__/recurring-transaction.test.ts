import { describe, expect, it } from "vitest";

import {
  newRecurringTransactionSchema,
  recurringFormSchema,
  recurringTransactionDocumentSchema,
} from "../recurring-transaction";

describe("recurring transaction schemas", () => {
  it("rejects privileged processing fields on create payloads", () => {
    const result = newRecurringTransactionSchema.safeParse({
      name: "Rent",
      schedule: { type: "interval", every: 1, unit: "month" },
      firstScheduledLocal: "2026-08-01T09:00:00",
      template: {
        amount: 1000,
        transactionType: "expense",
      },
      zone: "Europe/Rome",
      observation: "2026-07-21T10:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a guided create form for interval and finite totals", () => {
    const result = recurringFormSchema.safeParse({
      name: "Gym",
      scheduleKind: "interval",
      intervalEvery: "1",
      intervalUnit: "month",
      monthlyDay: "1",
      firstScheduledLocal: "2026-08-01T09:00",
      totalMode: "finite",
      totalOccurrences: "12",
      amount: "45.00",
      transactionType: "expense",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(4500);
    }
  });

  it("parses a document without privileged fields", () => {
    const result = recurringTransactionDocumentSchema.safeParse({
      recurringTransaction: {
        id: "rt-1",
        name: "Rent",
        lifecycle: "active",
        totalOccurrences: 12,
        fulfilledCount: 0,
        revision: 1,
        lifecycleChangedAt: "2026-07-21T10:00:00",
        createdAt: "2026-07-21T10:00:00",
        updatedAt: "2026-07-21T10:00:00",
      },
      schedule: {
        id: "sched-1",
        recurringTransactionId: "rt-1",
        sequence: 1,
        effectiveFromLocal: "2026-08-01T09:00:00",
        firstScheduledLocal: "2026-08-01T09:00:00",
        rule: { type: "interval", every: 1, unit: "month" },
      },
      template: {
        id: "tmpl-1",
        recurringTransactionId: "rt-1",
        sequence: 1,
        effectiveFromLocal: "2026-08-01T09:00:00",
        amount: 120000,
        transactionType: "expense",
      },
      occurrenceSummary: {
        fulfilledCount: 0,
        totalOccurrences: 12,
        nextScheduledLocal: "2026-08-01T09:00:00",
        needsAttention: false,
      },
      links: { state: "empty", occurrences: { items: [] } },
      failures: { state: "empty", history: { items: [] } },
      budgetImpact: {
        state: "unavailable",
        message: "Budget impact will appear once forecast projections are available.",
      },
    });
    expect(result.success).toBe(true);
  });
});
