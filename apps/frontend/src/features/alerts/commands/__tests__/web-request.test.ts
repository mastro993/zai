import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import { resolveWebApiBaseUrl } from "@/commands/web-api";

import {
  buildGetUnreadAlertCountRequest,
  buildListAlertsRequest,
  buildMarkAlertReadRequest,
  buildMarkAlertUnreadRequest,
  buildMarkAllAlertsReadRequest,
} from "../web-requests";

const unwrap = <T>(result: ReturnType<typeof buildListAlertsRequest>): T | undefined => {
  expect(Result.isSuccess(result)).toBe(true);
  return Result.isSuccess(result) ? (result.value as T) : undefined;
};

describe("alerts web requests", () => {
  it("maps alert reads and mutations to their HTTP contracts", () => {
    expect(unwrap(buildListAlertsRequest({}))).toEqual({
      method: "GET",
      path: "/alerts",
      query: undefined,
    });
    expect(unwrap(buildGetUnreadAlertCountRequest(undefined))).toEqual({
      method: "GET",
      path: "/alerts/unread-count",
    });
    expect(unwrap(buildMarkAllAlertsReadRequest(undefined))).toEqual({
      method: "POST",
      path: "/alerts/mark-all-read",
      body: {},
    });
    expect(unwrap(buildMarkAlertReadRequest({ alertId: "alert-1" }))).toEqual({
      method: "POST",
      path: "/alerts/alert-1/read",
      body: {},
    });
    expect(unwrap(buildMarkAlertUnreadRequest({ alertId: "alert-1" }))).toEqual({
      method: "POST",
      path: "/alerts/alert-1/unread",
      body: {},
    });
  });

  it("serializes alert filters, cursor, and repeated severities", () => {
    expect(
      unwrap(
        buildListAlertsRequest({
          query: {
            readState: "unread",
            severities: ["warning", "critical"],
            cursor: "cursor-1",
            limit: 25,
          },
        }),
      ),
    ).toEqual({
      method: "GET",
      path: "/alerts",
      query: {
        cursor: "cursor-1",
        limit: "25",
        readState: "unread",
        severities: ["warning", "critical"],
      },
    });
  });

  it("uses the shared API base", () => {
    expect(resolveWebApiBaseUrl()).toBe("http://127.0.0.1:3000/api");
  });

  it("rejects malformed identifiers locally", () => {
    const result = buildMarkAlertReadRequest({ alertId: "" });
    expect(Result.isFailure(result)).toBe(true);
  });
});
