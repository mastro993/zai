const REGION_CURRENCY = {
  AE: "AED",
  AT: "EUR",
  AU: "AUD",
  BE: "EUR",
  BG: "BGN",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  CY: "EUR",
  CZ: "CZK",
  DE: "EUR",
  DK: "DKK",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  GR: "EUR",
  HK: "HKD",
  HR: "EUR",
  HU: "HUF",
  ID: "IDR",
  IE: "EUR",
  IL: "ILS",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  MX: "MXN",
  MY: "MYR",
  NL: "EUR",
  NO: "NOK",
  NZ: "NZD",
  PH: "PHP",
  PL: "PLN",
  PT: "EUR",
  RO: "RON",
  SA: "SAR",
  SE: "SEK",
  SG: "SGD",
  SI: "EUR",
  SK: "EUR",
  TH: "THB",
  TR: "TRY",
  US: "USD",
  VN: "VND",
  ZA: "ZAR",
} as const;

const FALLBACK_CURRENCY = "EUR";

export const localeSuggestedCurrency = (
  locale: string,
  supportedCodes: ReadonlySet<string>,
): string => {
  const region = new Intl.Locale(locale).maximize().region ?? "";
  let guess = FALLBACK_CURRENCY;
  for (const [code, currency] of Object.entries(REGION_CURRENCY)) {
    if (code === region) {
      guess = currency;
      break;
    }
  }
  return supportedCodes.has(guess) ? guess : FALLBACK_CURRENCY;
};

export const deviceLocaleTag = (language = globalThis.navigator?.language): string => {
  return language && language.length > 0 ? language : "en-US";
};
