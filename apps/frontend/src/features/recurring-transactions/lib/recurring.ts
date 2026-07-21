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
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const defaultFirstScheduledLocal = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
