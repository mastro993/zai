import type { DomainAlertReadState, DomainAlertSeverity } from "../types/domain-alert";

export type AlertSeverityFilter = "all" | DomainAlertSeverity;

export interface AlertSessionFilters {
  readState: DomainAlertReadState;
  severity: AlertSeverityFilter;
}

export const DEFAULT_ALERT_SESSION_FILTERS: AlertSessionFilters = {
  readState: "unread",
  severity: "all",
};

let sessionFilters: AlertSessionFilters = { ...DEFAULT_ALERT_SESSION_FILTERS };

export const getAlertSessionFilters = (): AlertSessionFilters => ({ ...sessionFilters });

export const setAlertSessionFilters = (filters: AlertSessionFilters): void => {
  sessionFilters = { ...filters };
};

export const isDefaultAlertSessionFilters = (filters: AlertSessionFilters): boolean =>
  filters.readState === DEFAULT_ALERT_SESSION_FILTERS.readState &&
  filters.severity === DEFAULT_ALERT_SESSION_FILTERS.severity;

export const hasActiveAlertFilters = (filters: AlertSessionFilters): boolean =>
  filters.readState === "read" || filters.severity !== DEFAULT_ALERT_SESSION_FILTERS.severity;
