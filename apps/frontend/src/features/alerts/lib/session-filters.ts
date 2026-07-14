import type { DomainAlertReadState, DomainAlertSeverity } from "../types/domain-alert";

export type AlertSeverityFilter = "all" | DomainAlertSeverity;

export interface AlertSessionFilters {
  readState: DomainAlertReadState;
  severity: AlertSeverityFilter;
}

const defaultFilters: AlertSessionFilters = {
  readState: "all",
  severity: "all",
};

let sessionFilters: AlertSessionFilters = { ...defaultFilters };

export const getAlertSessionFilters = (): AlertSessionFilters => ({ ...sessionFilters });

export const setAlertSessionFilters = (filters: AlertSessionFilters): void => {
  sessionFilters = { ...filters };
};

export const hasActiveAlertFilters = (filters: AlertSessionFilters): boolean =>
  filters.readState !== "all" || filters.severity !== "all";
