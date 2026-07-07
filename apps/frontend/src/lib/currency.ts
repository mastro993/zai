const currencyFormatterByCode = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (currency: string) => {
  const existingFormatter = currencyFormatterByCode.get(currency);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  currencyFormatterByCode.set(currency, formatter);
  return formatter;
};

/**
 * Formats an integer amount expressed in minor units (e.g. cents) into
 * a localized currency string for the provided ISO 4217 currency code.
 *
 * Example: formatCurrencyFromMinor(1234, "EUR") => "€12.34" (locale-dependent)
 */
export const formatCurrencyFromMinor = (
  minorUnits: number,
  currency: string,
) => {
  return getCurrencyFormatter(currency).format(minorUnits / 100);
};
