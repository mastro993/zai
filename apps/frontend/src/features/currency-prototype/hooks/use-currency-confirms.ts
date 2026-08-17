import { useState } from "react";

import type { CurrencyPrototypeActions } from "./use-currency-prototype-state";

export const useCurrencyConfirms = (actions: CurrencyPrototypeActions) => {
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const [pendingManualRate, setPendingManualRate] = useState<string | null>(null);
  const [addCode, setAddCode] = useState("");
  const [manualDraft, setManualDraft] = useState("");
  const [pendingManualDraft, setPendingManualDraft] = useState("");

  return {
    pendingDefault,
    pendingDisable,
    pendingManualRate,
    addCode,
    manualDraft,
    pendingManualDraft,
    setAddCode,
    setManualDraft,
    setPendingManualDraft,
    askDefault: setPendingDefault,
    askDisable: setPendingDisable,
    askManualRate: (rate: string) => setPendingManualRate(rate),
    cancel: () => {
      setPendingDefault(null);
      setPendingDisable(null);
      setPendingManualRate(null);
    },
    confirmDefault: () => {
      if (pendingDefault) {
        actions.setDefault(pendingDefault);
      }
      setPendingDefault(null);
    },
    confirmDisable: () => {
      if (pendingDisable) {
        actions.disable(pendingDisable);
      }
      setPendingDisable(null);
    },
    confirmManualRate: () => {
      if (pendingManualRate) {
        actions.setManualRate(pendingManualRate);
      }
      setPendingManualRate(null);
    },
  };
};
