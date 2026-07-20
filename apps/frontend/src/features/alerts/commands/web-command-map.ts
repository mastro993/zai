import type { CommandArgs } from "@/commands/types";
import { readString, readStringArray, readRecord } from "@/commands/web-request-args";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const ALERT_COMMANDS = new Set([
  "list_alerts",
  "get_unread_alert_count",
  "mark_all_alerts_read",
  "mark_alert_read",
  "mark_alert_unread",
]);

const buildAlertsListSearch = (args: CommandArgs = {}): string => {
  const query = readRecord(args.query);
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  const cursor = readString(query.cursor);
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }
  const readState = readString(query.readState);
  if (readState && readState !== "all") {
    params.set("readState", readState);
  }
  const severities = readStringArray(query.severities);
  if (severities) {
    for (const severity of severities) {
      params.append("severities", severity);
    }
  }

  return params.toString();
};

export const buildAlertCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "list_alerts": {
      const search = buildAlertsListSearch(args);
      return {
        method: "GET",
        path: search ? `/alerts?${search}` : "/alerts",
      };
    }
    case "get_unread_alert_count":
      return { method: "GET", path: "/alerts/unread-count" };
    case "mark_all_alerts_read":
      return { method: "POST", path: "/alerts/mark-all-read", body: {} };
    case "mark_alert_read": {
      const alertId = readString(args.alertId);
      return {
        method: "POST",
        path: alertId ? `/alerts/${alertId}/read` : "/alerts/__missing_alert_id__/read",
        body: {},
      };
    }
    case "mark_alert_unread": {
      const alertId = readString(args.alertId);
      return {
        method: "POST",
        path: alertId ? `/alerts/${alertId}/unread` : "/alerts/__missing_alert_id__/unread",
        body: {},
      };
    }
    default:
      return undefined;
  }
};
