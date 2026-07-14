import { formatDistanceToNowStrict, parseISO } from "date-fns";

import type { DomainAlertSeverity } from "../types/domain-alert";

export const domainAlertSeverityLabel = (severity: DomainAlertSeverity): string => {
  switch (severity) {
    case "info":
      return "Info";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
  }
};

export const formatAlertCreatedAt = (createdAt: string): string => {
  const parsed = parseISO(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return createdAt;
  }
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

export const alertsBellLabel = (unreadCount: number): string => {
  if (unreadCount === 1) {
    return "Alerts, 1 unread";
  }
  return `Alerts, ${unreadCount} unread`;
};
