import { describe, expect, it } from "vitest";

import {
  resolveAlertsApiBaseUrl,
  resolveWebApiBaseUrlForCommand,
} from "@/commands/web-command-map";

import { buildAlertCommandRequestSpec } from "../web-command-map";

describe("alerts web requests", () => {
  it("maps alert reads and mutations to their HTTP contracts", () => {
    expect(buildAlertCommandRequestSpec("list_alerts")).toEqual({
      method: "GET",
      path: "/alerts",
    });
    expect(buildAlertCommandRequestSpec("get_unread_alert_count")).toEqual({
      method: "GET",
      path: "/alerts/unread-count",
    });
    expect(buildAlertCommandRequestSpec("mark_all_alerts_read")).toEqual({
      method: "POST",
      path: "/alerts/mark-all-read",
      body: {},
    });
    expect(buildAlertCommandRequestSpec("mark_alert_read", { alertId: "alert-1" })).toEqual({
      method: "POST",
      path: "/alerts/alert-1/read",
      body: {},
    });
    expect(buildAlertCommandRequestSpec("mark_alert_unread", { alertId: "alert-1" })).toEqual({
      method: "POST",
      path: "/alerts/alert-1/unread",
      body: {},
    });
  });

  it("serializes alert filters, cursor, and repeated severities", () => {
    expect(
      buildAlertCommandRequestSpec("list_alerts", {
        query: {
          readState: "unread",
          severities: ["warning", "critical"],
          cursor: "v1|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8",
          limit: 25,
        },
      }),
    ).toEqual({
      method: "GET",
      path: "/alerts?cursor=v1%7C2026-07-14T12%3A00%3A00.000000000%7C6ba7b810-9dad-11d1-80b4-00c04fd430c8&limit=25&readState=unread&severities=warning&severities=critical",
    });
  });

  it("omits the default all-read filter", () => {
    expect(
      buildAlertCommandRequestSpec("list_alerts", {
        query: { readState: "all" },
      }),
    ).toEqual({
      method: "GET",
      path: "/alerts",
    });
  });

  it("routes alert commands to the alerts API namespace", () => {
    expect(resolveWebApiBaseUrlForCommand("list_alerts")).toBe(resolveAlertsApiBaseUrl());
    expect(resolveWebApiBaseUrlForCommand("get_unread_alert_count")).toBe(
      resolveAlertsApiBaseUrl(),
    );
  });
});
