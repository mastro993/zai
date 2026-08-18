import { Result } from "@praha/byethrow";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { CommandError } from "@/commands/errors";

import {
  completeInitialCurrencySetup,
  getCurrencies,
  getCurrencyBootstrap,
  getCurrencyStatus,
  getSupportedCurrencies,
} from "../commands/currency";
import { deviceLocaleTag, localeSuggestedCurrency } from "../lib/locale-suggested-currency";
import type {
  CurrencyBootstrap,
  CurrencyJob,
  CurrencySettingsRow,
  SupportedCurrency,
} from "../types/currency";
import {
  CurrencyStateReconciliationError,
  useCurrencyStateLiveEvents,
} from "./use-currency-state-live-events";

interface CurrencyBootstrapContextValue {
  ready: boolean;
  setupComplete: boolean;
  defaultCurrency: string | null;
  catalog: SupportedCurrency[];
  currencies: CurrencySettingsRow[];
  currentJob: CurrencyJob | null;
  suggestedCurrency: string;
  errorMessage: string | null;
  confirmSetup: (code: string) => Result.ResultAsync<CurrencyJob, CommandError>;
}

const CurrencyBootstrapContext = createContext<CurrencyBootstrapContextValue | null>(null);

const emptyBootstrap: CurrencyBootstrap = {
  setupComplete: false,
  defaultCurrency: null,
};

export function CurrencyBootstrapProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootstrap, setBootstrap] = useState(emptyBootstrap);
  const [catalog, setCatalog] = useState<SupportedCurrency[]>([]);
  const [currencies, setCurrencies] = useState<CurrencySettingsRow[]>([]);
  const [currentJob, setCurrentJob] = useState<CurrencyJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reconcile = useCallback(async () => {
    const bootstrapResult = await getCurrencyBootstrap();
    if (Result.isFailure(bootstrapResult)) {
      return Result.fail(
        new CurrencyStateReconciliationError(bootstrapResult.error.message, bootstrapResult.error),
      );
    }
    const catalogResult = await getSupportedCurrencies();
    if (Result.isFailure(catalogResult)) {
      return Result.fail(
        new CurrencyStateReconciliationError(catalogResult.error.message, catalogResult.error),
      );
    }
    const statusResult = await getCurrencyStatus();
    if (Result.isFailure(statusResult)) {
      return Result.fail(
        new CurrencyStateReconciliationError(statusResult.error.message, statusResult.error),
      );
    }

    let nextCurrencies: CurrencySettingsRow[] = [];
    if (bootstrapResult.value.setupComplete) {
      const currenciesResult = await getCurrencies();
      if (Result.isFailure(currenciesResult)) {
        return Result.fail(
          new CurrencyStateReconciliationError(
            currenciesResult.error.message,
            currenciesResult.error,
          ),
        );
      }
      nextCurrencies = currenciesResult.value;
    }

    setBootstrap(bootstrapResult.value);
    setCatalog(catalogResult.value);
    setCurrencies(nextCurrencies);
    setCurrentJob(statusResult.value.job);
    setErrorMessage(null);
    setReady(true);
    return Result.succeed(undefined);
  }, []);

  useCurrencyStateLiveEvents({
    onReconcile: reconcile,
    onReady: reconcile,
    onReconciliationFailure: (error) => {
      setErrorMessage(error.message);
      setReady(true);
    },
  });

  const confirmSetup = useCallback(
    async (code: string) => {
      const result = await completeInitialCurrencySetup(code);
      if (Result.isFailure(result)) {
        return result;
      }
      await reconcile();
      return result;
    },
    [reconcile],
  );

  const suggestedCurrency = useMemo(() => {
    const supported = new Set(catalog.map((item) => item.code));
    if (supported.size === 0) {
      return "EUR";
    }
    return localeSuggestedCurrency(deviceLocaleTag(), supported);
  }, [catalog]);

  const value = useMemo(
    () => ({
      ready,
      setupComplete: bootstrap.setupComplete,
      defaultCurrency: bootstrap.defaultCurrency,
      catalog,
      currencies,
      currentJob,
      suggestedCurrency,
      errorMessage,
      confirmSetup,
    }),
    [
      bootstrap.defaultCurrency,
      bootstrap.setupComplete,
      catalog,
      confirmSetup,
      currencies,
      currentJob,
      errorMessage,
      ready,
      suggestedCurrency,
    ],
  );

  return (
    <CurrencyBootstrapContext.Provider value={value}>{children}</CurrencyBootstrapContext.Provider>
  );
}

export function useCurrencyBootstrap(): CurrencyBootstrapContextValue {
  const value = useContext(CurrencyBootstrapContext);
  if (value === null) {
    throw new Error("useCurrencyBootstrap must be used within CurrencyBootstrapProvider");
  }
  return value;
}
