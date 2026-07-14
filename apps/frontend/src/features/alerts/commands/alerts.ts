import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { DomainAlertListPage, ListDomainAlertsQuery } from "../types/domain-alert";

export const listAlerts = (query?: ListDomainAlertsQuery): CommandResult<DomainAlertListPage> => {
  return invokeCommand<DomainAlertListPage>("list_alerts", query ? { query } : undefined);
};

export const getUnreadAlertCount = (): CommandResult<number> => {
  return invokeCommand<number>("get_unread_alert_count");
};
