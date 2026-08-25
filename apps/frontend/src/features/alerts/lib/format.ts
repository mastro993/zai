import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

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

const parseAlertInstant = (createdAt: string): Date | null => {
  const parsed = parseISO(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const formatAlertCreatedAt = (createdAt: string): string => {
  const parsed = parseAlertInstant(createdAt);
  if (!parsed) {
    return createdAt;
  }
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

export const formatAlertTimestamp = (createdAt: string): string => {
  const parsed = parseAlertInstant(createdAt);
  if (!parsed) {
    return createdAt;
  }
  return format(parsed, "PPpp");
};

export const alertsBellLabel = (unreadCount: number): string => {
  if (unreadCount === 1) {
    return "Alerts, 1 unread";
  }
  return `Alerts, ${unreadCount} unread`;
};
