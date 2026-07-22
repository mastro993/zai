import type {
  BudgetPeriodForecast,
  BudgetProjectionResult,
  ProjectionSourceErrorKind,
} from "../types/budget-projection";

export interface ForecastMatrixColumn {
  periodStart: string;
  periodEnd: string;
  label: string;
}

export interface ForecastMatrixRow {
  budgetId: string;
  budgetName: string;
  cells: Array<BudgetPeriodForecast | undefined>;
}

export interface ForecastMatrix {
  columns: Array<ForecastMatrixColumn>;
  rows: Array<ForecastMatrixRow>;
}

export const formatForecastPeriodLabel = (periodStart: string, periodEnd: string): string =>
  `${periodStart.slice(0, 10)} to ${periodEnd.slice(0, 10)}`;

export const formatProjectionSourceErrorKind = (kind: ProjectionSourceErrorKind): string => {
  switch (kind) {
    case "dueCatchUp":
      return "Catch-up due";
    case "generationBlocked":
      return "Generation blocked";
    case "staleBudgetTimeline":
      return "Stale budget timeline";
    case "missingRevision":
      return "Missing revision";
  }
};

export const buildForecastMatrix = (result: BudgetProjectionResult): ForecastMatrix => {
  if (result.periods.length === 0) {
    return { columns: [], rows: [] };
  }

  const columnByStart = new Map<string, ForecastMatrixColumn>();
  const rowByBudget = new Map<
    string,
    { budgetId: string; budgetName: string; cellsByStart: Map<string, BudgetPeriodForecast> }
  >();

  for (const period of result.periods) {
    if (!columnByStart.has(period.periodStart)) {
      columnByStart.set(period.periodStart, {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        label: formatForecastPeriodLabel(period.periodStart, period.periodEnd),
      });
    }

    const existing = rowByBudget.get(period.budgetId);
    if (existing) {
      existing.cellsByStart.set(period.periodStart, period);
    } else {
      rowByBudget.set(period.budgetId, {
        budgetId: period.budgetId,
        budgetName: period.budgetName,
        cellsByStart: new Map([[period.periodStart, period]]),
      });
    }
  }

  const columns = [...columnByStart.values()].toSorted((left, right) =>
    left.periodStart.localeCompare(right.periodStart),
  );
  const rows = [...rowByBudget.values()]
    .toSorted((left, right) => left.budgetName.localeCompare(right.budgetName))
    .map((row) => ({
      budgetId: row.budgetId,
      budgetName: row.budgetName,
      cells: columns.map((column) => row.cellsByStart.get(column.periodStart)),
    }));

  return { columns, rows };
};
