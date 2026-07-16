import { useCallback, useRef, useState } from "react";

import { activateAlertFromToast } from "../lib/activate-alert-from-toast";
import type { DomainAlert } from "../types/domain-alert";
import { type DestinationFeedback } from "./use-alert-destination";
import type { RefreshOptions } from "./use-alerts-list";

interface UseAlertsLedgerOptions {
  refresh: (options?: RefreshOptions) => Promise<void>;
}

export function useAlertsLedger({ refresh }: UseAlertsLedgerOptions) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerFocusAlertId, setLedgerFocusAlertId] = useState<string | null>(null);
  const [destinationFeedback, setDestinationFeedback] = useState<DestinationFeedback | null>(null);

  const openLedger = useCallback(() => {
    setIsLedgerOpen(true);
    setLedgerFocusAlertId(null);
    setDestinationFeedback(null);
    void refresh({ preserveItems: true });
  }, [refresh]);

  const closeLedger = useCallback(() => {
    setIsLedgerOpen(false);
    setLedgerFocusAlertId(null);
    setDestinationFeedback(null);
    bellRef.current?.focus();
  }, []);

  const createActivateAlertFromToastHandler = useCallback(
    (openAlert: (alert: DomainAlert) => Promise<void>) => async (alert: DomainAlert) =>
      activateAlertFromToast(alert, {
        openAlert,
        refresh,
        setDestinationFeedback,
        setIsLedgerOpen,
        setLedgerFocusAlertId,
      }),
    [refresh],
  );

  return {
    bellRef,
    closeLedger,
    createActivateAlertFromToastHandler,
    destinationFeedback,
    isLedgerOpen,
    ledgerFocusAlertId,
    openLedger,
    setDestinationFeedback,
  };
}
