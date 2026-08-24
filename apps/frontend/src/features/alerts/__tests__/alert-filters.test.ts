import { describe, expect, it } from "vitest";

import { buildListAlertsQuery } from "../lib/build-list-query";
import { hasActiveAlertFilters, isDefaultAlertSessionFilters } from "../lib/session-filters";

describe("buildListAlertsQuery", () => {
  it("omits default filters and maps active filters to query params", () => {
    expect(buildListAlertsQuery({ readState: "all", severity: "all" })).toEqual({});
    expect(
      buildListAlertsQuery(
        { readState: "unread", severity: "warning" },
        { cursor: "v1|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
      ),
    ).toEqual({
      readState: "unread",
      severities: ["warning"],
      cursor: "v1|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });
  });
});

describe("hasActiveAlertFilters", () => {
  it("flags restrictive read-only or severity filters, not show-read", () => {
    expect(hasActiveAlertFilters({ readState: "unread", severity: "all" })).toBe(false);
    expect(hasActiveAlertFilters({ readState: "all", severity: "all" })).toBe(false);
    expect(hasActiveAlertFilters({ readState: "read", severity: "all" })).toBe(true);
    expect(hasActiveAlertFilters({ readState: "unread", severity: "critical" })).toBe(true);
  });
});

describe("isDefaultAlertSessionFilters", () => {
  it("treats unread plus all severities as the default view", () => {
    expect(isDefaultAlertSessionFilters({ readState: "unread", severity: "all" })).toBe(true);
    expect(isDefaultAlertSessionFilters({ readState: "all", severity: "all" })).toBe(false);
    expect(isDefaultAlertSessionFilters({ readState: "unread", severity: "warning" })).toBe(false);
  });
});
