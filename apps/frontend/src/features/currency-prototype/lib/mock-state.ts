export type CurrencyStatus = "enabled" | "adding" | "disabled" | "failed";
export type RefreshStatus = "fresh" | "stale" | "failed" | "idle";
export type RateOrigin = "supplied" | "manual" | "pending";
export type ImportAction = "already-enabled" | "add" | "re-enable" | "backfill";

export interface CatalogCurrency {
  code: string;
  name: string;
}

export interface PrototypeCurrency {
  code: string;
  name: string;
  status: CurrencyStatus;
  coverageFrom: string | null;
  coverageTo: string | null;
  lastRefresh: string | null;
  refreshStatus: RefreshStatus;
  missingPeriods: string[];
  usedByRecurring: boolean;
}

export interface PrototypeTransactionDraft {
  description: string;
  amount: string;
  currency: string;
  date: string;
  rate: string;
  rateOrigin: RateOrigin;
  rateDate: string | null;
}

export interface PrototypePendingTransaction {
  description: string;
  originalAmount: string;
  currency: string;
  date: string;
  status: "pending" | "resolved";
  rate: string | null;
  rateOrigin: RateOrigin;
}

export interface PrototypeImportNeed {
  code: string;
  name: string;
  action: ImportAction;
  coverage: string;
}

export interface PrototypeState {
  defaultCurrency: string;
  localeCurrency: string;
  lastUsedTransactionCurrency: string | null;
  setupComplete: boolean;
  currencies: PrototypeCurrency[];
  catalog: CatalogCurrency[];
  transaction: PrototypeTransactionDraft;
  pendingTransaction: PrototypePendingTransaction;
  importNeeds: PrototypeImportNeed[];
  importConfirmed: boolean;
  lastAction: string;
}

const RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.9214,
  GBP: 1.1742,
  JPY: 0.00613,
  CHF: 1.0518,
  CAD: 0.6721,
};

export const CATALOG: CatalogCurrency[] = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CAD", name: "Canadian Dollar" },
];

const currency = (
  code: string,
  status: CurrencyStatus,
  extras: Partial<PrototypeCurrency> = {},
): PrototypeCurrency => {
  const name = CATALOG.find((item) => item.code === code)?.name ?? code;
  return {
    code,
    name,
    status,
    coverageFrom: status === "failed" ? null : "2018-01-01",
    coverageTo: status === "adding" || status === "failed" ? null : "2026-08-17",
    lastRefresh: status === "enabled" ? "2026-08-17 09:42" : null,
    refreshStatus:
      code === "GBP" && status === "enabled"
        ? "stale"
        : status === "enabled"
          ? "fresh"
          : status === "failed"
            ? "failed"
            : "idle",
    missingPeriods: status === "failed" ? ["2019-03-29", "2020-04-13"] : [],
    usedByRecurring: code === "CHF",
    ...extras,
  };
};

export const createInitialPrototypeState = (): PrototypeState => ({
  defaultCurrency: "EUR",
  localeCurrency: "EUR",
  lastUsedTransactionCurrency: "USD",
  setupComplete: false,
  currencies: [
    currency("EUR", "enabled"),
    currency("USD", "enabled"),
    currency("GBP", "enabled", { lastRefresh: "2026-08-16 18:10", refreshStatus: "stale" }),
    currency("JPY", "adding", { coverageFrom: null, coverageTo: null, lastRefresh: null }),
    currency("CHF", "disabled", { lastRefresh: "2026-08-12 11:04", refreshStatus: "idle" }),
  ],
  catalog: CATALOG,
  transaction: {
    description: "Hotel, Lisbon",
    amount: "186.40",
    currency: "USD",
    date: "2026-08-14",
    rate: "0.9214",
    rateOrigin: "supplied",
    rateDate: "2026-08-14",
  },
  pendingTransaction: {
    description: "Dinner, Tokyo",
    originalAmount: "4800",
    currency: "JPY",
    date: "2026-08-09",
    status: "pending",
    rate: null,
    rateOrigin: "pending",
  },
  importNeeds: [
    { code: "USD", name: "US Dollar", action: "already-enabled", coverage: "2018-2026 complete" },
    { code: "GBP", name: "British Pound", action: "backfill", coverage: "2018-03 missing 2 days" },
    { code: "CAD", name: "Canadian Dollar", action: "add", coverage: "2018-2026 to retrieve" },
    { code: "CHF", name: "Swiss Franc", action: "re-enable", coverage: "2018-2026 complete" },
  ],
  importConfirmed: false,
  lastAction: "Loaded prototype fixtures. Default EUR. Last-used transaction currency USD.",
});

export const formatMoney = (amount: string, code: string) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${amount} ${code}`;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    minimumFractionDigits: code === "JPY" ? 0 : 2,
    maximumFractionDigits: code === "JPY" ? 0 : 2,
  }).format(value);
};

export const convertToDefault = (amount: string, from: string, to: string) => {
  const value = Number(amount);
  const fromRate = RATES_TO_EUR[from];
  const toRate = RATES_TO_EUR[to];
  if (!Number.isFinite(value) || fromRate === undefined || toRate === undefined) {
    return null;
  }

  const converted = (value * fromRate) / toRate;
  return converted.toFixed(to === "JPY" ? 0 : 2);
};

export const rateFor = (code: string, defaultCurrency: string) => {
  const fromRate = RATES_TO_EUR[code];
  const toRate = RATES_TO_EUR[defaultCurrency];
  if (fromRate === undefined || toRate === undefined) {
    return null;
  }

  return (fromRate / toRate).toFixed(6);
};

export const findCurrency = (state: PrototypeState, code: string) =>
  state.currencies.find((item) => item.code === code);

export const selectableTransactionCurrencies = (state: PrototypeState) =>
  state.currencies.filter((item) => item.status === "enabled");

export const selectableDefaultCurrencies = (state: PrototypeState) =>
  state.currencies.filter((item) => item.status === "enabled");

export const addableCatalog = (state: PrototypeState) =>
  state.catalog.filter((item) => !state.currencies.some((owned) => owned.code === item.code));

export const preselectedTransactionCurrency = (state: PrototypeState) => {
  const lastUsed = state.lastUsedTransactionCurrency;
  if (lastUsed && findCurrency(state, lastUsed)?.status === "enabled") {
    return lastUsed;
  }

  return state.defaultCurrency;
};

const markAction = (state: PrototypeState, lastAction: string): PrototypeState => ({
  ...state,
  lastAction,
});

export const completeSetup = (state: PrototypeState, code: string) =>
  markAction(
    { ...state, defaultCurrency: code, setupComplete: true },
    `Initial currency setup confirmed ${code} as the default currency.`,
  );

export const setDefaultCurrency = (state: PrototypeState, code: string) => {
  const target = findCurrency(state, code);
  if (!target || target.status !== "enabled") {
    return markAction(state, `Cannot set ${code} as default. It is not an enabled currency.`);
  }

  return markAction(
    { ...state, defaultCurrency: code },
    `Default currency is now ${code}. Original amounts and transaction currencies stay.`,
  );
};

export const disableCurrency = (state: PrototypeState, code: string) => {
  if (code === state.defaultCurrency) {
    return markAction(state, `Cannot disable ${code}. It is the default currency.`);
  }

  return markAction(
    {
      ...state,
      currencies: state.currencies.map((item) =>
        item.code === code ? { ...item, status: "disabled" } : item,
      ),
    },
    `Disabled ${code}. History stays. Recurring templates keep it.`,
  );
};

export const reenableCurrency = (state: PrototypeState, code: string) =>
  markAction(
    {
      ...state,
      currencies: state.currencies.map((item) =>
        item.code === code ? { ...item, status: "enabled", refreshStatus: "fresh" } : item,
      ),
    },
    `Re-enabled ${code}. It can be selected again.`,
  );

export const startAddCurrency = (state: PrototypeState, code: string) => {
  const catalogItem = state.catalog.find((item) => item.code === code);
  if (!catalogItem) {
    return markAction(state, `${code} is not a supported currency.`);
  }

  const existing = findCurrency(state, code);
  if (existing) {
    return markAction(
      {
        ...state,
        currencies: state.currencies.map((item) =>
          item.code === code
            ? { ...item, status: "adding", missingPeriods: [], coverageTo: null }
            : item,
        ),
      },
      `Retrieving complete historical coverage for ${code}.`,
    );
  }

  return markAction(
    {
      ...state,
      currencies: [
        ...state.currencies,
        currency(code, "adding", { coverageFrom: null, coverageTo: null, lastRefresh: null }),
      ],
    },
    `Adding ${code}. Not selectable until coverage is complete.`,
  );
};

export const finishAddCurrency = (state: PrototypeState, code: string) =>
  markAction(
    {
      ...state,
      currencies: state.currencies.map((item) =>
        item.code === code
          ? {
              ...item,
              status: "enabled",
              coverageFrom: "2018-01-01",
              coverageTo: "2026-08-17",
              lastRefresh: "2026-08-17 10:02",
              refreshStatus: "fresh",
              missingPeriods: [],
            }
          : item,
      ),
    },
    `Enabled ${code}. Complete historical coverage validated.`,
  );

export const failAddCurrency = (state: PrototypeState, code: string) =>
  markAction(
    {
      ...state,
      currencies: state.currencies.map((item) =>
        item.code === code
          ? {
              ...item,
              status: "failed",
              missingPeriods: ["2019-03-29", "2020-04-13"],
              refreshStatus: "failed",
            }
          : item,
      ),
    },
    `Addition failed for ${code}. Missing periods listed. Partial activation blocked.`,
  );

export const setTransactionCurrency = (state: PrototypeState, code: string) => {
  const nextRate = rateFor(code, state.defaultCurrency);
  const replacingManual = state.transaction.rateOrigin === "manual";
  return markAction(
    {
      ...state,
      lastUsedTransactionCurrency: code,
      transaction: {
        ...state.transaction,
        currency: code,
        rate: nextRate ?? state.transaction.rate,
        rateOrigin: "supplied",
        rateDate: state.transaction.date,
      },
    },
    replacingManual
      ? `Changed transaction currency to ${code}. New date-specific rate replaces the manual rate.`
      : `Transaction currency is ${code}. Date-specific supplied rate applied.`,
  );
};

export const setTransactionAmount = (state: PrototypeState, amount: string) =>
  markAction(
    { ...state, transaction: { ...state.transaction, amount } },
    `Original amount set to ${amount} ${state.transaction.currency}. Existing rate kept.`,
  );

export const setManualRate = (state: PrototypeState, rate: string) =>
  markAction(
    {
      ...state,
      transaction: {
        ...state.transaction,
        rate,
        rateOrigin: "manual",
        rateDate: state.transaction.date,
      },
    },
    `Manual exchange rate ${rate} stored. Origin remains visible.`,
  );

export const retryPending = (state: PrototypeState) => {
  const nextRate = rateFor(state.pendingTransaction.currency, state.defaultCurrency);
  return markAction(
    {
      ...state,
      pendingTransaction: {
        ...state.pendingTransaction,
        status: "resolved",
        rate: nextRate,
        rateOrigin: "supplied",
      },
    },
    `Retry succeeded. Supplied rate locked for Dinner, Tokyo.`,
  );
};

export const resolvePendingWithManual = (state: PrototypeState, rate: string) =>
  markAction(
    {
      ...state,
      pendingTransaction: {
        ...state.pendingTransaction,
        status: "resolved",
        rate,
        rateOrigin: "manual",
      },
    },
    `Pending rate recovered with a manual exchange rate of ${rate}.`,
  );

export const confirmImport = (state: PrototypeState) => {
  let next = state;
  for (const need of state.importNeeds) {
    if (need.action === "add") {
      next = finishAddCurrency(startAddCurrency(next, need.code), need.code);
    }
    if (need.action === "re-enable") {
      next = reenableCurrency(next, need.code);
    }
    if (need.action === "backfill") {
      next = {
        ...next,
        currencies: next.currencies.map((item) =>
          item.code === need.code
            ? { ...item, refreshStatus: "fresh", lastRefresh: "2026-08-17 10:08" }
            : item,
        ),
      };
    }
  }

  return markAction(
    { ...next, importConfirmed: true },
    "Import confirmed. Currencies prepared and rows imported as one atomic operation.",
  );
};
