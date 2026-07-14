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

  it("routes alert commands to the alerts API base", () => {
    expect(resolveWebApiBaseUrlForCommand("list_alerts")).toBe(resolveAlertsApiBaseUrl());
    expect(resolveWebApiBaseUrlForCommand("get_budgets")).not.toBe(resolveAlertsApiBaseUrl());
  });
});
