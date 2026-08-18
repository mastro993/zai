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
});

describe("transaction result schemas", () => {
  it("decodes a convert-only list item without original money", () => {
    const parsed = transactionListItemSchema.parse({
      id: "tx-1",
      description: "Coffee",
      transactionDate: "2026-07-01T10:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
      convertedAmount: 350,
      convertedCurrency: "EUR",
      complete: true,
    });

    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("currency");
    expect(parsed).not.toHaveProperty("exchangeRate");
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
