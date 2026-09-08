import { addDays, addHours, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import { formatBudgetMinor } from "./budget";
import type { BudgetOverview } from "../types/budget";
import { isoFractionDigits } from "@/lib/currency";

export interface BudgetChartLabel {
  label: string;
  position: number;
}

export interface BudgetChartPoint {
  complete: boolean;
  position: number;
  value: number;
}

export interface BudgetChartYAxisLabel {
  label: string;
  position: number;
  y: number;
}

export interface BudgetChartData {
  labels: Array<BudgetChartLabel>;
  points: Array<BudgetChartPoint>;
  yAxisLabels: Array<BudgetChartYAxisLabel>;
  actualPath: string;
  actualAreaPath: string;
  summary: string;
}

interface ChartCoordinate {
  x: number;
  y: number;
}

const CHART_WIDTH = 320;
export const BUDGET_CHART_Y_AXIS_WIDTH = 34;
export const BUDGET_CHART_Y_AXIS_LABEL_GAP = 6;
const CHART_TOP = 8;
const CHART_BOTTOM = 92;
const Y_AXIS_LABEL_TOP = 12;
const Y_AXIS_LABEL_BOTTOM = 90;

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

const formatAxisValue = (minorUnits: number, currency: string) => {
  const fractionDigits = isoFractionDigits(currency);
  const minorStep = 10 ** fractionDigits * 10;
  const roundedMinorUnits = Math.round(minorUnits / minorStep) * minorStep;
  const majorUnits = roundedMinorUnits / 10 ** fractionDigits;
  const abbreviated = Math.abs(majorUnits) >= 100;
  const displayValue = abbreviated ? majorUnits / 1000 : majorUnits;
  const displayNumber = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: abbreviated ? 1 : 0,
  }).format(displayValue);
  const currencyParts = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(majorUnits);
  const currencyPart = currencyParts.find((part) => part.type === "currency")?.value ?? currency;
  const numberPartIndex = currencyParts.findIndex((part) => part.type === "integer");
  const currencyPartIndex = currencyParts.findIndex((part) => part.type === "currency");
  const suffix = abbreviated ? "k" : "";
  const label =
    currencyPartIndex < numberPartIndex
      ? `${currencyPart}${displayNumber}${suffix}`
      : `${displayNumber}${suffix}${currencyPart}`;
  return label.replace(/\s/g, "");
};

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

const chartPositionAt = (date: Date, starts: Array<Date>, periodEnd: Date): number => {
  const firstStart = starts[0];
  if (!firstStart || date <= firstStart) {
    return 0;
  }
  if (date >= periodEnd) {
    return 1;
  }

  const intervalIndex = starts.findLastIndex((start) => start <= date);
  if (intervalIndex < 0 || intervalIndex >= starts.length - 1) {
    return 1;
  }
  const intervalStart = starts[intervalIndex];
  const intervalEnd = starts[intervalIndex + 1];
  const intervalSpan = Math.max(intervalEnd.getTime() - intervalStart.getTime(), 1);
  const intervalProgress = (date.getTime() - intervalStart.getTime()) / intervalSpan;
  return (intervalIndex + intervalProgress) / Math.max(starts.length - 1, 1);
};

export const createBudgetChartData = (
  budget: BudgetOverview,
  now: Date = new Date(),
): BudgetChartData => {
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
  const currentPosition = chartPositionAt(now, starts, parseISO(budget.currentPeriod.end));
  const visiblePoints = points.filter(({ position }) => position <= currentPosition);
  const coordinates = visiblePoints.map(({ position, value }) => ({
    x: position * CHART_WIDTH,
    y: CHART_BOTTOM - ((value - min) / valueSpan) * (CHART_BOTTOM - CHART_TOP),
  }));
  const lastVisiblePoint = visiblePoints.at(-1);
  if (lastVisiblePoint && lastVisiblePoint.position < currentPosition) {
    coordinates.push({
      x: currentPosition * CHART_WIDTH,
      y: CHART_BOTTOM - ((lastVisiblePoint.value - min) / valueSpan) * (CHART_BOTTOM - CHART_TOP),
    });
  }
  const labels = chartLabels(budget, starts);
  const yAxisLabels = Array.from({ length: 4 }, (_, index) => {
    const value = max * (1 - index / 3);
    const y = CHART_BOTTOM - ((value - min) / valueSpan) * (CHART_BOTTOM - CHART_TOP);
    return {
      label: formatAxisValue(value, budget.currentPeriod.currency),
      position: index,
      y: Math.min(Y_AXIS_LABEL_BOTTOM, Math.max(Y_AXIS_LABEL_TOP, y)),
    };
  });
  const summary = starts
    .map(
      (start, index) =>
        `${format(start, budget.cadence === "year" ? "MMM" : budget.cadence === "day" ? "ha" : "MMM d")} ${formatBudgetMinor(points[index].value, budget.currentPeriod.currency)}`,
    )
    .join(", ");

  return {
    labels,
    points,
    yAxisLabels,
    actualPath: chartPath(coordinates),
    actualAreaPath: chartAreaPath(coordinates),
    summary: `${complete ? "Actual cumulative spending" : "Known cumulative spending; some conversions are incomplete"}: ${summary}.`,
  };
};
