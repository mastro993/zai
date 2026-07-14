import type { DomainAlert } from "../types/domain-alert";

interface ActivateAlertFromToastDeps {
  openAlert: (alert: DomainAlert) => Promise<void>;
  refresh: (options?: { preserveItems?: boolean }) => Promise<void>;
  setDestinationFeedback: (value: null) => void;
  setIsLedgerOpen: (open: boolean) => void;
  setLedgerFocusAlertId: (alertId: string | null) => void;
}

export async function activateAlertFromToast(
  alert: DomainAlert,
  {
    openAlert,
    refresh,
    setDestinationFeedback,
    setIsLedgerOpen,
    setLedgerFocusAlertId,
  }: ActivateAlertFromToastDeps,
): Promise<void> {
  setLedgerFocusAlertId(alert.id);
  setIsLedgerOpen(true);
  setDestinationFeedback(null);
  await refresh({ preserveItems: true });
  await openAlert(alert);
  setLedgerFocusAlertId(null);
}
