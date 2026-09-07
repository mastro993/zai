import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  getDaysInMonth,
  parseISO,
  startOfWeek,
} from "date-fns";

import { formatBudgetMinor } from "./budget";
import type { Budget } from "../types/budget";

export interface BudgetChartLabel {
  label: string;
  position: number;
}

export interface BudgetChartData {
  labels: Array<BudgetChartLabel>;
  actualPath: string;
  projectionPath: string;
  summary: string;
}

interface ChartPoint {
  date: Date;
  value: number;
}

const CHART_WIDTH = 320;
const CHART_TOP = 8;
const CHART_BOTTOM = 96;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const chartPath = (points: Array<ChartPoint>, start: Date, end: Date, min: number, max: number) => {
  const span = Math.max(end.getTime() - start.getTime(), 1);
  const valueSpan = Math.max(max - min, 1);
  return points
    .map((point, index) => {
      const x = ((point.date.getTime() - start.getTime()) / span) * CHART_WIDTH;
      const y = CHART_BOTTOM - ((point.value - min) / valueSpan) * (CHART_BOTTOM - CHART_TOP);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const chartRange = (budget: Budget, now: Date) => {
  const periodStart = parseISO(budget.currentPeriod.start);
  const periodEnd = addDays(parseISO(budget.currentPeriod.end), -1);
  if (budget.cadence === "day") {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }
  if (budget.cadence === "week") {
    return { start: periodStart, end: periodEnd };
  }
  if (budget.cadence === "year") {
    return { start: periodStart, end: periodEnd };
  }
  return { start: periodStart, end: periodEnd };
};

const chartLabels = (budget: Budget, start: Date, end: Date): Array<BudgetChartLabel> => {
  if (budget.cadence === "year") {
    return Array.from({ length: 12 }, (_, month) => ({
      label: format(new Date(start.getFullYear(), month, 1), "MMM"),
      position: month / 11,
    }));
  }

  const days = differenceInCalendarDays(end, start) + 1;
  if (budget.cadence === "month") {
    const labelDays = [1, 8, 15, 22, 29].filter((day) => day <= getDaysInMonth(start));
    return labelDays.map((day) => ({
      label: String(day),
      position: (day - 1) / Math.max(days - 1, 1),
    }));
  }

  return Array.from({ length: days }, (_, index) => ({
    label: format(addDays(start, index), "EEE"),
    position: index / Math.max(days - 1, 1),
  }));
};

export const createBudgetChartData = (budget: Budget, now: Date): BudgetChartData => {
  const { start, end } = chartRange(budget, now);
  const currentDate = new Date(clamp(now.getTime(), start.getTime(), end.getTime()));
  const spending = budget.currentPeriod.netBudgetSpending;
  const elapsed = clamp(
    (currentDate.getTime() - start.getTime()) / Math.max(end.getTime() - start.getTime(), 1),
    0,
    1,
  );
  const projected = elapsed > 0 ? spending / elapsed : spending;
  const allowance = budget.currentPeriod.effectiveAllowance ?? 0;
  const min = Math.min(0, spending, projected);
  const max = Math.max(allowance, spending, projected, 1);
  const actualPoints = [
    { date: start, value: 0 },
    { date: currentDate, value: spending },
  ];
  const projectionPoints = [
    { date: currentDate, value: spending },
    { date: end, value: projected },
  ];
  const projectedLabel = formatBudgetMinor(Math.round(projected), budget.currentPeriod.currency);
  const spendingLabel = formatBudgetMinor(spending, budget.currentPeriod.currency);

  return {
    labels: chartLabels(budget, start, end),
    actualPath: chartPath(actualPoints, start, end, min, max),
    projectionPath: chartPath(projectionPoints, start, end, min, max),
    summary: `${spendingLabel} spent at current pace. Pace-based projection is ${projectedLabel} by period end.`,
  };
};
