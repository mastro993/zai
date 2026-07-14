import type { CommandArgs } from "./types";
import type { WebRequestSpec } from "./web-command-map";

export const ALERT_COMMANDS = new Set([
  "list_alerts",
  "get_unread_alert_count",
  "mark_all_alerts_read",
  "mark_alert_read",
  "mark_alert_unread",
]);

const readString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

export const buildAlertCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "get_unread_alert_count":
      return { method: "GET", path: "/alerts/unread-count" };
    case "mark_all_alerts_read":
      return { method: "POST", path: "/alerts/mark-all-read" };
    case "mark_alert_read": {
      const alertId = readString(args.alertId);
      return {
        method: "POST",
        path: alertId ? `/alerts/${alertId}/read` : "/alerts/__missing_alert_id__/read",
      };
    }
    case "mark_alert_unread": {
      const alertId = readString(args.alertId);
      return {
        method: "POST",
        path: alertId ? `/alerts/${alertId}/unread` : "/alerts/__missing_alert_id__/unread",
      };
    }
    default:
      return undefined;
  }
};
