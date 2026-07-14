import { toast } from "sonner";

import type { DomainAlert } from "../types/domain-alert";
import type { DomainAlertEvent } from "../types/domain-alert-event";

export interface UrgentAlertToastContext {
  hasFocus: () => boolean;
  visibilityState: DocumentVisibilityState;
}

interface ToastPresenter {
  warning: typeof toast.warning;
  error: typeof toast.error;
}

const defaultPresenter: ToastPresenter = {
  warning: toast.warning.bind(toast),
  error: toast.error.bind(toast),
};

export const isUrgentAlertSeverity = (
  severity: DomainAlert["severity"],
): severity is "warning" | "critical" => severity === "warning" || severity === "critical";

export const shouldShowUrgentAlertToast = (
  event: DomainAlertEvent | null,
  context: UrgentAlertToastContext,
): event is Extract<DomainAlertEvent, { type: "created" }> =>
  event?.type === "created" &&
  isUrgentAlertSeverity(event.alert.severity) &&
  context.visibilityState === "visible" &&
  context.hasFocus();

export const showUrgentAlertToast = (
  alert: DomainAlert,
  onActivate: (alert: DomainAlert) => void,
  presenter: ToastPresenter = defaultPresenter,
): void => {
  const options = {
    description: alert.body,
    action: {
      label: "Open alert",
      onClick: () => onActivate(alert),
    },
  };

  if (alert.severity === "critical") {
    presenter.error(alert.title, options);
    return;
  }

  presenter.warning(alert.title, options);
};
