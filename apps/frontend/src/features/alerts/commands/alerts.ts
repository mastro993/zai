import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { DomainAlertListPage } from "../types/domain-alert";

export const listAlerts = (): CommandResult<DomainAlertListPage> => {
  return invokeCommand<DomainAlertListPage>("list_alerts");
};

export const getUnreadAlertCount = (): CommandResult<number> => {
  return invokeCommand<number>("get_unread_alert_count");
};
