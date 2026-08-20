import type { CurrencyJob, CurrencySettingsRow } from "../types/currency";

export interface RefreshProgressView {
  current: number;
  total: number;
}

export interface CurrencyRefreshMeterModel {
  value: number | null;
  label: string;
  detail: string;
}

const ratio = (current: number, total: number): number | null => {
  if (total <= 0) {
    return null;
  }
  return Math.min(100, Math.round((current / total) * 100));
};

const shortStamp = (value: string | null): string => {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
};

export const currencyRefreshMeter = ({
  row,
  job,
  refreshProgress,
}: {
  row: CurrencySettingsRow;
  job: CurrencyJob | null;
  refreshProgress: RefreshProgressView | null;
}): CurrencyRefreshMeterModel => {
  if (refreshProgress !== null && row.status !== "disabled") {
    return {
      value: ratio(refreshProgress.current, refreshProgress.total),
      label: "Refreshing",
      detail:
        refreshProgress.total > 0
          ? `${refreshProgress.current} of ${refreshProgress.total}`
          : "Starting",
    };
  }
  if (
    row.status === "adding" &&
    job !== null &&
    job.currencyCode === row.code &&
    job.stageTotal > 0
  ) {
    return {
      value: ratio(job.stageCurrent, job.stageTotal),
      label: "Adding",
      detail: `${job.stageCurrent} of ${job.stageTotal}`,
    };
  }
  const stamp = shortStamp(row.lastRefresh);
  if (row.refreshStatus === "fresh") {
    return { value: 100, label: "Fresh", detail: stamp || "Up to date" };
  }
  if (row.refreshStatus === "stale") {
    return { value: 100, label: "Stale", detail: stamp || "Needs refresh" };
  }
  if (row.refreshStatus === "failed") {
    return {
      value: row.coverageFrom === null ? 0 : 100,
      label: "Failed",
      detail: stamp || "Retry",
    };
  }
  return { value: 0, label: "Idle", detail: stamp || "Waiting" };
};
