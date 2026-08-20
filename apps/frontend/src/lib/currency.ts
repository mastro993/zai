import { Result } from "@praha/byethrow";

const currencyFormatterByCode = new Map<string, Intl.NumberFormat>();
const fractionDigitsByCurrency = new Map<string, number>();

export const isoFractionDigits = (currency: string) => {
  const cached = fractionDigitsByCurrency.get(currency);
  if (cached !== undefined) {
    return cached;
  }

  const digitsResult = Result.try({
    try: () =>
      new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2,
    catch: (): number => 2,
  });
  const digits = Result.isSuccess(digitsResult) ? digitsResult.value : 2;

  fractionDigitsByCurrency.set(currency, digits);
  return digits;
};

const getCurrencyFormatter = (currency: string) => {
  const existingFormatter = currencyFormatterByCode.get(currency);
  if (existingFormatter) {
    return existingFormatter;
  }

  const fractionDigits = isoFractionDigits(currency);
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  currencyFormatterByCode.set(currency, formatter);
  return formatter;
};

/**
 * Formats an integer amount expressed in ISO minor units into a localized
 * currency string for the provided ISO 4217 currency code.
 *
 * Example: formatCurrencyFromMinor(1234, "EUR") => "€12.34" (locale-dependent)
 */
export const formatCurrencyFromMinor = (minorUnits: number, currency: string) => {
  const digits = isoFractionDigits(currency);
  return getCurrencyFormatter(currency).format(minorUnits / 10 ** digits);
};

export const currencyDisplaySymbol = (currency: string) => {
  const symbolResult = Result.try({
    try: () => {
      const parts = new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(
        0,
      );
      return parts.find((part) => part.type === "currency")?.value ?? currency;
    },
    catch: (): string => currency,
  });

  return Result.isSuccess(symbolResult) ? symbolResult.value : currency;
};

export const localizeDecimalString = (value: string) => {
  const decimalSeparator =
    new Intl.NumberFormat(undefined).formatToParts(1.1).find((part) => part.type === "decimal")
      ?.value ?? ".";

  return value.includes(".") ? value.replace(".", decimalSeparator) : value;
};
