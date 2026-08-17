import { useMemo, useState } from "react";

import {
  completeSetup,
  confirmImport,
  createInitialPrototypeState,
  disableCurrency,
  failAddCurrency,
  finishAddCurrency,
  reenableCurrency,
  resolvePendingWithManual,
  retryPending,
  setDefaultCurrency,
  setManualRate,
  setTransactionAmount,
  setTransactionCurrency,
  startAddCurrency,
  type PrototypeState,
} from "../lib/mock-state";

export interface CurrencyPrototypeActions {
  completeSetup: (code: string) => void;
  setDefault: (code: string) => void;
  disable: (code: string) => void;
  reenable: (code: string) => void;
  startAdd: (code: string) => void;
  finishAdd: (code: string) => void;
  failAdd: (code: string) => void;
  setTransactionCurrency: (code: string) => void;
  setTransactionAmount: (amount: string) => void;
  setManualRate: (rate: string) => void;
  retryPending: () => void;
  resolvePendingWithManual: (rate: string) => void;
  confirmImport: () => void;
  reset: () => void;
}

export const useCurrencyPrototypeState = () => {
  const [state, setState] = useState<PrototypeState>(createInitialPrototypeState);

  const actions = useMemo<CurrencyPrototypeActions>(
    () => ({
      completeSetup: (code) => setState((current) => completeSetup(current, code)),
      setDefault: (code) => setState((current) => setDefaultCurrency(current, code)),
      disable: (code) => setState((current) => disableCurrency(current, code)),
      reenable: (code) => setState((current) => reenableCurrency(current, code)),
      startAdd: (code) => setState((current) => startAddCurrency(current, code)),
      finishAdd: (code) => setState((current) => finishAddCurrency(current, code)),
      failAdd: (code) => setState((current) => failAddCurrency(current, code)),
      setTransactionCurrency: (code) =>
        setState((current) => setTransactionCurrency(current, code)),
      setTransactionAmount: (amount) =>
        setState((current) => setTransactionAmount(current, amount)),
      setManualRate: (rate) => setState((current) => setManualRate(current, rate)),
      retryPending: () => setState((current) => retryPending(current)),
      resolvePendingWithManual: (rate) =>
        setState((current) => resolvePendingWithManual(current, rate)),
      confirmImport: () => setState((current) => confirmImport(current)),
      reset: () => setState(createInitialPrototypeState()),
    }),
    [],
  );

  return { state, actions };
};
