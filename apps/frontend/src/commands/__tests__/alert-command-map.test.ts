import { describe, expect, it } from "vitest";

import {
  buildWebRequestSpec,
  resolveAlertsApiBaseUrl,
  resolveWebApiBaseUrlForCommand,
} from "../web-command-map";

describe("alerts web command map", () => {
  it("maps list and unread count reads to the alerts API", () => {
    expect(buildWebRequestSpec("list_alerts")).toEqual({
      method: "GET",
      path: "/alerts",
    });
    expect(buildWebRequestSpec("get_unread_alert_count")).toEqual({
      method: "GET",
      path: "/alerts/unread-count",
    });
  });

  it("serializes list query filters and cursor into the request path", () => {
    expect(
      buildWebRequestSpec("list_alerts", {
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

  it("routes alert commands to the alerts API base", () => {
    expect(resolveWebApiBaseUrlForCommand("list_alerts")).toBe(resolveAlertsApiBaseUrl());
    expect(resolveWebApiBaseUrlForCommand("get_budgets")).not.toBe(resolveAlertsApiBaseUrl());
  });
});
