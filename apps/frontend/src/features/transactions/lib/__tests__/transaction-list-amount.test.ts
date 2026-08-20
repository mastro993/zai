import { describe, expect, it } from "vitest";

import { formatCurrencyFromMinor } from "@/lib/currency";

import { transactionListAmountParts } from "../transaction-list-amount";

describe("transactionListAmountParts", () => {
  it("returns only the converted amount when currencies match", () => {
    expect(
      transactionListAmountParts({
        amount: 350,
        currency: "EUR",
        convertedAmount: 350,
        convertedCurrency: "EUR",
        complete: true,
      }),
    ).toEqual({
      original: null,
      display: formatCurrencyFromMinor(350, "EUR"),
    });
  });

  it("returns the original amount beside the converted amount when currencies differ", () => {
    expect(
      transactionListAmountParts({
        amount: 4550,
        currency: "USD",
        convertedAmount: 4000,
        convertedCurrency: "EUR",
        complete: true,
      }),
    ).toEqual({
      original: formatCurrencyFromMinor(4550, "USD"),
      display: formatCurrencyFromMinor(4000, "EUR"),
    });
  });

  it("keeps the original amount when the converted result is incomplete", () => {
    expect(
      transactionListAmountParts({
        amount: 4550,
        currency: "USD",
        convertedAmount: null,
        convertedCurrency: "EUR",
        complete: false,
      }),
    ).toEqual({
      original: formatCurrencyFromMinor(4550, "USD"),
      display: "Incomplete",
    });
  });
});
