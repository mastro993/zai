import { describe, expect, it } from "vitest";

import { buildListAlertsQuery } from "../lib/build-list-query";
import { hasActiveAlertFilters } from "../lib/session-filters";

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
  it("detects non-default read and severity filters", () => {
    expect(hasActiveAlertFilters({ readState: "all", severity: "all" })).toBe(false);
    expect(hasActiveAlertFilters({ readState: "read", severity: "all" })).toBe(true);
    expect(hasActiveAlertFilters({ readState: "all", severity: "critical" })).toBe(true);
  });
});
