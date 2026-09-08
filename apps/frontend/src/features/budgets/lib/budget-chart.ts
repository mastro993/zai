import { addDays, addHours, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import { formatBudgetMinor } from "./budget";
import type { BudgetOverview } from "../types/budget";

export interface BudgetChartLabel {
  label: string;
  position: number;
}

export interface BudgetChartPoint {
  complete: boolean;
  position: number;
  value: number;
}

export interface BudgetChartData {
  labels: Array<BudgetChartLabel>;
  points: Array<BudgetChartPoint>;
  actualPath: string;
  actualAreaPath: string;
  summary: string;
}

interface ChartCoordinate {
  x: number;
  y: number;
}

const CHART_WIDTH = 320;
const CHART_TOP = 8;
const CHART_BOTTOM = 92;

const chartPath = (coordinates: Array<ChartCoordinate>) =>
  coordinates
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }
      const previous = coordinates[index - 1];
      const controlOffset = (point.x - previous.x) * 0.4;
      return `C ${(previous.x + controlOffset).toFixed(2)} ${previous.y.toFixed(2)} ${(point.x - controlOffset).toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");

const chartAreaPath = (coordinates: Array<ChartCoordinate>) => {
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (!first || !last) {
    return "";
  }
  return `${chartPath(coordinates)} L ${last.x.toFixed(2)} ${CHART_BOTTOM} L ${first.x.toFixed(2)} ${CHART_BOTTOM} Z`;
};

const intervalStarts = (budget: BudgetOverview): Array<Date> => {
  const start = parseISO(budget.currentPeriod.start);
  const end = parseISO(budget.currentPeriod.end);
  if (budget.cadence === "day") {
    return Array.from({ length: 24 }, (_, index) => addHours(start, index));
  }
  if (budget.cadence === "year") {
    return Array.from({ length: 12 }, (_, index) => addMonths(start, index));
  }
  return Array.from({ length: Math.max(differenceInCalendarDays(end, start), 1) }, (_, index) =>
    addDays(start, index),
  );
};

const chartLabels = (budget: BudgetOverview, starts: Array<Date>): Array<BudgetChartLabel> => {
  if (budget.cadence === "day") {
    return [0, 6, 12, 18, 24].map((hour) => ({
      label: format(addHours(starts[0], hour), "ha").toLowerCase(),
      position: hour / 24,
    }));
  }
  if (budget.cadence === "year") {
    return starts.map((date, index) => ({
      label: format(date, "MMM"),
      position: index / Math.max(starts.length - 1, 1),
    }));
  }
  if (budget.cadence === "month") {
    const offsets = [0, 7, 14, 21, starts.length - 1].filter(
      (offset, index, values) => offset >= 0 && values.indexOf(offset) === index,
    );
    return offsets.map((offset) => ({
      label: format(starts[offset], "d"),
      position: offset / Math.max(starts.length - 1, 1),
    }));
  }
  return starts.map((date, index) => ({
    label: format(date, "EEE"),
    position: index / Math.max(starts.length - 1, 1),
  }));
};

export const createBudgetChartData = (budget: BudgetOverview): BudgetChartData => {
  const starts = intervalStarts(budget);
  const buckets = new Map(
    budget.spendingBuckets.map((bucket) => [parseISO(bucket.start).getTime(), bucket]),
  );
  let cumulative = 0;
  let complete = true;
  const points = starts.map((start, index): BudgetChartPoint => {
    const bucket = buckets.get(start.getTime());
    cumulative += bucket?.value ?? 0;
    complete &&= bucket?.complete ?? true;
    return {
      complete,
      position: index / Math.max(starts.length - 1, 1),
      value: cumulative,
    };
  });
  const values = points.map(({ value }) => value);
  const min = Math.min(0, ...values);
  const max = Math.max(budget.currentPeriod.effectiveAllowance ?? 0, ...values, 1);
  const valueSpan = Math.max(max - min, 1);
  const coordinates = points.map(({ position, value }) => ({
    x: position * CHART_WIDTH,
    y: CHART_BOTTOM - ((value - min) / valueSpan) * (CHART_BOTTOM - CHART_TOP),
  }));
  const labels = chartLabels(budget, starts);
  const summary = starts
    .map(
      (start, index) =>
        `${format(start, budget.cadence === "year" ? "MMM" : budget.cadence === "day" ? "ha" : "MMM d")} ${formatBudgetMinor(points[index].value, budget.currentPeriod.currency)}`,
    )
    .join(", ");

  return {
    labels,
    points,
    actualPath: chartPath(coordinates),
    actualAreaPath: chartAreaPath(coordinates),
    summary: `${complete ? "Actual cumulative spending" : "Known cumulative spending; some conversions are incomplete"}: ${summary}.`,
  };
};
