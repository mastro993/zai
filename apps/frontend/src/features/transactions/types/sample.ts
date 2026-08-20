import {
  transactionListItemSchema,
  transactionSchema,
  type Transaction,
  type TransactionListItem,
} from "./model";

const identityRate = (currency: string, transactionDate: string) => ({
  variant: "identity" as const,
  rateDate: transactionDate.slice(0, 10),
  sourceCurrency: currency,
  referenceCurrency: currency,
  originalDecimal: "1",
  coefficient: 1,
  scale: 0,
  origin: "supplied" as const,
});

export const sampleTransaction = (
  overrides: Partial<Transaction> & Pick<Transaction, "id">,
): Transaction => {
  const currency = overrides.currency ?? "EUR";
  const amount = overrides.amount ?? 350;
  const transactionDate = overrides.transactionDate ?? "2026-07-01T10:00:00";

  return transactionSchema.parse({
    description: null,
    amount,
    currency,
    transactionDate,
    transactionType: "expense",
    transactionCategoryId: null,
    notes: null,
    exchangeRate: identityRate(currency, transactionDate),
    convertedAmount: amount,
    convertedCurrency: currency,
    complete: true,
    ...overrides,
  });
};

export const sampleListItem = (
  overrides: Partial<TransactionListItem> & Pick<TransactionListItem, "id">,
): TransactionListItem =>
  transactionListItemSchema.parse({
    description: null,
    transactionDate: "2026-07-01T10:00:00",
    transactionType: "expense",
    transactionCategoryId: null,
    notes: null,
    amount: 350,
    currency: "EUR",
    convertedAmount: 350,
    convertedCurrency: "EUR",
    complete: true,
    ...overrides,
  });
