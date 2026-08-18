let lastUsedTransactionCurrency: string | null = null;

export const getLastUsedTransactionCurrency = () => lastUsedTransactionCurrency;

export const setLastUsedTransactionCurrency = (currency: string) => {
  lastUsedTransactionCurrency = currency;
};

export const resetLastUsedTransactionCurrency = () => {
  lastUsedTransactionCurrency = null;
};
