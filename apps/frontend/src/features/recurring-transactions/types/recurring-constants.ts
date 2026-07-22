export const RECURRING_LIFECYCLES = [
  "active",
  "paused",
  "stopped",
  "completed",
  "tombstoned",
] as const;

export const SCHEDULE_INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export const TRANSACTION_TYPES = ["expense", "income"] as const;
export const SECTION_STATES = ["ready", "empty", "unavailable"] as const;
