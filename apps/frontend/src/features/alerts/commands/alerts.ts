import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type {
  DomainAlert,
  DomainAlertListPage,
  ListDomainAlertsQuery,
} from "../types/domain-alert";
import { ALERT_COMMANDS } from "./registry";

export const listAlerts = (query?: ListDomainAlertsQuery): CommandResult<DomainAlertListPage> => {
  return invokeDecodedCommand(ALERT_COMMANDS.list_alerts, query ? { query } : undefined);
};

export const getUnreadAlertCount = (): CommandResult<number> => {
  return invokeDecodedCommand(ALERT_COMMANDS.get_unread_alert_count);
};

export const markAllAlertsRead = (): CommandResult<number> => {
  return invokeDecodedCommand(ALERT_COMMANDS.mark_all_alerts_read);
};

export const markAlertRead = (alertId: string): CommandResult<DomainAlert> => {
  return invokeDecodedCommand(ALERT_COMMANDS.mark_alert_read, { alertId });
};

export const markAlertUnread = (alertId: string): CommandResult<DomainAlert> => {
  return invokeDecodedCommand(ALERT_COMMANDS.mark_alert_unread, { alertId });
};
