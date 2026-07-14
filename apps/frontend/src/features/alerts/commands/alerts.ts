import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { DomainAlert, DomainAlertListPage } from "../types/domain-alert";

export const listAlerts = (): CommandResult<DomainAlertListPage> => {
  return invokeCommand<DomainAlertListPage>("list_alerts");
};

export const getUnreadAlertCount = (): CommandResult<number> => {
  return invokeCommand<number>("get_unread_alert_count");
};

export const markAlertRead = (alertId: string): CommandResult<DomainAlert> => {
  return invokeCommand<DomainAlert>("mark_alert_read", { alertId });
};

export const markAlertUnread = (alertId: string): CommandResult<DomainAlert> => {
  return invokeCommand<DomainAlert>("mark_alert_unread", { alertId });
};
