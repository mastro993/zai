import type { RecurringLifecycle, ScheduleRule } from "../types/recurring-transaction";

export const recurringLifecycleLabel: Record<RecurringLifecycle, string> = {
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
  completed: "Completed",
  tombstoned: "Deleted",
};

export const formatScheduleRule = (rule: ScheduleRule): string => {
  if (rule.type === "monthlyDay") {
    return `Monthly on day ${rule.day}`;
  }
  const unitLabel = rule.every === 1 ? rule.unit : rule.unit === "day" ? "days" : `${rule.unit}s`;
  return `Every ${rule.every} ${unitLabel}`;
};

export const formatFiniteProgress = (
  fulfilledCount: number,
  totalOccurrences: number | null,
): string | undefined => {
  if (totalOccurrences === null) {
    return undefined;
  }
  return `${fulfilledCount} of ${totalOccurrences}`;
};

export const progressRatio = (
  fulfilledCount: number,
  totalOccurrences: number | null,
): number | undefined => {
  if (totalOccurrences === null || totalOccurrences <= 0) {
    return undefined;
  }
  return Math.min(1, fulfilledCount / totalOccurrences);
};

export const formatLocalDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return value;
  }
  const [, year, month, day, hour, minute] = match;
  const asLocal = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(asLocal);
};

const padLocalPart = (value: number) => String(value).padStart(2, "0");

export const defaultFirstScheduledLocal = (): string => {
  // Advance one minute so the default still passes backend creation-time checks
  // after the user fills the form for a few seconds.
  const now = new Date(Date.now() + 60_000);
  return `${now.getFullYear()}-${padLocalPart(now.getMonth() + 1)}-${padLocalPart(now.getDate())}T${padLocalPart(now.getHours())}:${padLocalPart(now.getMinutes())}`;
};
