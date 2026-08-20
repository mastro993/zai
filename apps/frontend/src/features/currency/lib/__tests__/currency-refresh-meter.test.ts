import { describe, expect, it } from "vitest";

import type { CurrencyJob, CurrencySettingsRow } from "../../types/currency";
import { currencyRefreshMeter } from "../currency-refresh-meter";

const row = (overrides: Partial<CurrencySettingsRow> = {}): CurrencySettingsRow => ({
  code: "USD",
  name: "US Dollar",
  status: "enabled",
  coverageFrom: "1999-01-04",
  coverageTo: "2026-08-18",
  lastRefresh: "2026-08-18T12:00:00Z",
  refreshStatus: "fresh",
  missingPeriods: [],
  usedByRecurring: false,
  isDefault: false,
  ...overrides,
});

const addingJob = (overrides: Partial<CurrencyJob> = {}): CurrencyJob => ({
  jobId: "job-1",
  type: "addCurrency",
  status: "running",
  stageCurrent: 1,
  stageTotal: 2,
  currencyCode: "USD",
  ...overrides,
});

describe("currencyRefreshMeter", () => {
  it("uses live provider counts while a refresh is in flight", () => {
    expect(
      currencyRefreshMeter({
        row: row({ refreshStatus: "stale" }),
        job: null,
        refreshProgress: { current: 18, total: 28 },
      }),
    ).toEqual({
      value: 64,
      label: "Refreshing",
      detail: "18 of 28",
    });
  });

  it("stays indeterminate when the refresh has not reported a total", () => {
    expect(
      currencyRefreshMeter({
        row: row(),
        job: null,
        refreshProgress: { current: 0, total: 0 },
      }),
    ).toEqual({
      value: null,
      label: "Refreshing",
      detail: "Starting",
    });
  });

  it("ignores live refresh on disabled rows", () => {
    expect(
      currencyRefreshMeter({
        row: row({ status: "disabled", refreshStatus: "idle", lastRefresh: null }),
        job: null,
        refreshProgress: { current: 3, total: 28 },
      }),
    ).toEqual({
      value: 0,
      label: "Idle",
      detail: "Waiting",
    });
  });

  it("shows add-job stages when that currency is adding", () => {
    expect(
      currencyRefreshMeter({
        row: row({ status: "adding", refreshStatus: "idle", lastRefresh: null }),
        job: addingJob(),
        refreshProgress: null,
      }),
    ).toEqual({
      value: 50,
      label: "Adding",
      detail: "1 of 2",
    });
  });

  it("maps durable refresh status when idle", () => {
    expect(
      currencyRefreshMeter({
        row: row({ refreshStatus: "failed", coverageFrom: null, lastRefresh: null }),
        job: null,
        refreshProgress: null,
      }),
    ).toEqual({
      value: 0,
      label: "Failed",
      detail: "Retry",
    });
    expect(
      currencyRefreshMeter({
        row: row({ refreshStatus: "fresh" }),
        job: null,
        refreshProgress: null,
      }),
    ).toEqual({
      value: 100,
      label: "Fresh",
      detail: "2026-08-18",
    });
  });
});
