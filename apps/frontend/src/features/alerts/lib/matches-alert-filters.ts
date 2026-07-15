import type { DomainAlert } from "../types/domain-alert";
import type { AlertSessionFilters } from "./session-filters";
import { isUnreadAlert } from "./parse";

export const matchesAlertFilters = (alert: DomainAlert, filters: AlertSessionFilters): boolean => {
  if (filters.readState === "unread" && !isUnreadAlert(alert)) {
    return false;
  }
  if (filters.readState === "read" && isUnreadAlert(alert)) {
    return false;
  }
  if (filters.severity !== "all" && alert.severity !== filters.severity) {
    return false;
  }
  return true;
};
