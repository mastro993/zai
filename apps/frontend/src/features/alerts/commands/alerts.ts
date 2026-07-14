import { type CommandResult, invokeCommand } from "@/commands/shared";

import type {
  DomainAlert,
  DomainAlertListPage,
  ListDomainAlertsQuery,
} from "../types/domain-alert";

export const listAlerts = (query?: ListDomainAlertsQuery): CommandResult<DomainAlertListPage> => {
  return invokeCommand<DomainAlertListPage>("list_alerts", query ? { query } : undefined);
};

export const getUnreadAlertCount = (): CommandResult<number> => {
  return invokeCommand<number>("get_unread_alert_count");
};

export const markAllAlertsRead = (): CommandResult<number> => {
  return invokeCommand<number>("mark_all_alerts_read");
};

export const markAlertRead = (alertId: string): CommandResult<DomainAlert> => {
  return invokeCommand<DomainAlert>("mark_alert_read", { alertId });
};

export const markAlertUnread = (alertId: string): CommandResult<DomainAlert> => {
  return invokeCommand<DomainAlert>("mark_alert_unread", { alertId });
};
