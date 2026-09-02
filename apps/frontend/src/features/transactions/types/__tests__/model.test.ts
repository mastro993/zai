import { describe, expect, it } from "vitest";

import { transactionFormSchema, transactionListItemSchema, transactionSchema } from "../model";

describe("transactionFormSchema", () => {
  const input = {
    description: "",
    transactionDate: "2026-07-09T12:00",
    transactionType: "expense" as const,
    transactionCategoryId: "",
    notes: "",
    currency: "EUR",
  };

  it("accepts zero amounts", () => {
    for (const amount of ["0", "0.00", ".00"]) {
      const result = transactionFormSchema.safeParse({ ...input, amount });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.amount).toBe(0);
        expect(result.data.currency).toBe("EUR");
      }
    }
  });

  it("enforces the backend minor-unit boundary", () => {
    expect(transactionFormSchema.safeParse({ ...input, amount: "21474836.47" }).success).toBe(true);
    expect(transactionFormSchema.safeParse({ ...input, amount: "21474836.48" }).success).toBe(
      false,
    );
  });

  it("parses JPY using zero ISO fraction digits", () => {
    const result = transactionFormSchema.safeParse({
      ...input,
      currency: "JPY",
      amount: "1234",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(1234);
    }

    expect(
      transactionFormSchema.safeParse({ ...input, currency: "JPY", amount: "12.34" }).success,
    ).toBe(false);
  });

  it("normalizes a comma conversion rate", () => {
    const result = transactionFormSchema.safeParse({
      ...input,
      amount: "10.00",
      currency: "USD",
      manualExchangeRate: "0,95",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manualExchangeRate).toBe("0.95");
    }
  });

  it("drops a blank conversion rate", () => {
    const result = transactionFormSchema.safeParse({
      ...input,
      amount: "10.00",
      currency: "USD",
      manualExchangeRate: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manualExchangeRate).toBeUndefined();
    }
  });
});

describe("transaction result schemas", () => {
  it("decodes a list item with original money and converted fields", () => {
    const parsed = transactionListItemSchema.parse({
      id: "tx-1",
      description: "Coffee",
      transactionDate: "2026-07-01T10:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
      amount: 4550,
      currency: "USD",
      convertedAmount: 4000,
      convertedCurrency: "EUR",
      complete: true,
    });

    expect(parsed.amount).toBe(4550);
    expect(parsed.currency).toBe("USD");
    expect(parsed.convertedAmount).toBe(4000);
    expect(parsed.recurring).toBeNull();
    expect(parsed).not.toHaveProperty("exchangeRate");
  });

  it("decodes a list item with finite recurring provenance", () => {
    const parsed = transactionListItemSchema.parse({
      id: "tx-rent",
      description: "Rent",
      transactionDate: "2026-07-01T10:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
      amount: 120000,
      currency: "EUR",
      convertedAmount: 120000,
      convertedCurrency: "EUR",
      complete: true,
      recurring: {
        recurringTransactionId: "rt-rent",
        fulfillmentPosition: 2,
        totalOccurrences: 12,
      },
    });

    expect(parsed.recurring).toEqual({
      recurringTransactionId: "rt-rent",
      fulfillmentPosition: 2,
      totalOccurrences: 12,
    });
  });

  it("rejects a list item without original money", () => {
    expect(
      transactionListItemSchema.safeParse({
        id: "tx-1",
        description: "Coffee",
        transactionDate: "2026-07-01T10:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
        convertedAmount: 350,
        convertedCurrency: "EUR",
        complete: true,
      }).success,
    ).toBe(false);
  });

  it("rejects the earlier amount-only expand shape as a list item", () => {
    expect(
      transactionListItemSchema.safeParse({
        id: "tx-1",
        description: "Coffee",
        amount: 350,
        transactionDate: "2026-07-01T10:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      }).success,
    ).toBe(false);
  });

  it("decodes a detail DTO with original money and a pending rate", () => {
    const parsed = transactionSchema.parse({
      id: "tx-pending",
      description: "Hotel",
      amount: 10000,
      currency: "USD",
      transactionDate: "2026-07-01T10:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
      exchangeRate: {
        variant: "pending",
        rateDate: "2026-07-01",
        sourceCurrency: "USD",
        referenceCurrency: "EUR",
        origin: "supplied",
      },
      convertedAmount: null,
      convertedCurrency: "EUR",
      complete: false,
    });

    expect(parsed.amount).toBe(10000);
    expect(parsed.exchangeRate.variant).toBe("pending");
    expect(parsed.complete).toBe(false);
  });
});
