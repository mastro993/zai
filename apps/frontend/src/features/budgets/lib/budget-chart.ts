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

export interface BudgetChartSeriesPoint {
  position: number;
  projectionValue: number | null;
  value: number | null;
}

export interface BudgetChartYAxisLabel {
  label: string;
  position: number;
  value: number;
}

export interface BudgetChartData {
  labels: Array<BudgetChartLabel>;
  points: Array<BudgetChartPoint>;
  projectionPoints: Array<BudgetChartPoint>;
  series: Array<BudgetChartSeriesPoint>;
  yAxisLabels: Array<BudgetChartYAxisLabel>;
  yAxisDomain: [number, number];
  summary: string;
}

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
  const currentPosition = chartPositionAt(now, starts, parseISO(budget.currentPeriod.end));
  const visiblePoints = points.filter(({ position }) => position <= currentPosition);
  const chartPoints = [...visiblePoints];
  const lastVisiblePoint = chartPoints.at(-1);
  if (lastVisiblePoint && lastVisiblePoint.position < currentPosition) {
    chartPoints.push({
      ...lastVisiblePoint,
      position: currentPosition,
    });
  }
  const projectionStart = chartPoints.at(-1);
  const projectionPoints =
    projectionStart && currentPosition > 0 && currentPosition < 1
      ? [
          projectionStart,
          {
            ...projectionStart,
            position: 1,
            value: projectionStart.value / currentPosition,
          },
        ]
      : [];
  const values = [
    ...points.map(({ value }) => value),
    ...projectionPoints.map(({ value }) => value),
  ];
  const min = Math.min(0, ...values);
  const allowanceHeadroom = (budget.currentPeriod.effectiveAllowance ?? 0) * 1.1;
  const max = Math.max(allowanceHeadroom, ...values, 1);
  const series: Array<BudgetChartSeriesPoint> = chartPoints.map((point, index) => ({
    position: point.position,
    projectionValue:
      index === chartPoints.length - 1 && projectionPoints.length > 1 ? point.value : null,
    value: point.value,
  }));
  const projectionEnd = projectionPoints.at(-1);
  if (projectionEnd && projectionPoints.length > 1) {
    series.push({
      position: projectionEnd.position,
      projectionValue: projectionEnd.value,
      value: null,
    });
  }
  const labels = chartLabels(budget, starts);
  const tickMax = budget.currentPeriod.effectiveAllowance ?? max;
  const yAxisLabels = Array.from({ length: 4 }, (_, index) => {
    const value = tickMax * (1 - index / 3);
    return {
      label: formatAxisValue(value, budget.currentPeriod.currency),
      position: index,
      value,
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
    points: chartPoints,
    projectionPoints,
    series,
    yAxisLabels,
    yAxisDomain: [min, max],
    summary: `${complete ? "Actual cumulative spending" : "Known cumulative spending; some conversions are incomplete"}: ${summary}.`,
  };
};
