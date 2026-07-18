import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";

export type DateRangePresetId = "this-month" | "last-30-days" | "this-year" | "all-time";

export type DateRangeSelection =
  | { type: "preset"; id: DateRangePresetId }
  | { type: "custom"; from: string; to: string };

export interface DateRangeValue {
  startDate?: string;
  endDate?: string;
}

export const DATE_RANGE_PRESETS: ReadonlyArray<{ id: DateRangePresetId; label: string }> = [
  { id: "this-month", label: "This month" },
  { id: "last-30-days", label: "Last 30 days" },
  { id: "this-year", label: "This year" },
  { id: "all-time", label: "All time" },
];

export const DEFAULT_DATE_SELECTION: DateRangeSelection = { type: "preset", id: "all-time" };

const startBoundary = (date: Date) => `${format(date, "yyyy-MM-dd")}T00:00:00`;
const endBoundary = (date: Date) => `${format(date, "yyyy-MM-dd")}T23:59:59`;

const resolvePreset = (id: DateRangePresetId, now: Date): DateRangeValue => {
  switch (id) {
    case "this-month":
      return { startDate: startBoundary(startOfMonth(now)), endDate: endBoundary(endOfMonth(now)) };
    case "last-30-days":
      return { startDate: startBoundary(subDays(now, 29)), endDate: endBoundary(now) };
    case "this-year":
      return { startDate: startBoundary(startOfYear(now)), endDate: endBoundary(endOfYear(now)) };
    case "all-time":
      return {};
  }
};

export const resolveSelection = (
  selection: DateRangeSelection,
  now: Date = new Date(),
): DateRangeValue => {
  if (selection.type === "custom") {
    return {
      startDate: startBoundary(parseISO(selection.from)),
      endDate: endBoundary(parseISO(selection.to)),
    };
  }

  return resolvePreset(selection.id, now);
};

export const isActiveSelection = (selection: DateRangeSelection): boolean =>
  selection.type === "custom" || selection.id !== "all-time";

export const formatSelectionLabel = (selection: DateRangeSelection): string => {
  if (selection.type === "preset") {
    return DATE_RANGE_PRESETS.find((preset) => preset.id === selection.id)?.label ?? "All time";
  }

  const from = parseISO(selection.from);
  const to = parseISO(selection.to);

  if (selection.from === selection.to) {
    return format(from, "MMM d, yyyy");
  }

  const sameYear = from.getFullYear() === to.getFullYear();

  return `${format(from, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
};

export interface RangeDraft {
  from?: Date;
  to?: Date;
}

export interface RangeAdvance {
  draft: RangeDraft;
  committed?: { from: Date; to: Date };
}

// Two-click range machine: first click sets the start and waits; the second
// closes the range (same day = a single day); clicking once a range is already
// complete restarts from the new day.
export const advanceRangeSelection = (draft: RangeDraft | undefined, day: Date): RangeAdvance => {
  if (!draft?.from || draft.to) {
    return { draft: { from: day } };
  }

  const [start, end] = day < draft.from ? [day, draft.from] : [draft.from, day];

  return { draft: { from: start, to: end }, committed: { from: start, to: end } };
};
