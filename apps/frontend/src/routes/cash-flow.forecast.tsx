import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getRecurringBudgetProjections } from "@/features/recurring-transactions/commands/recurring-transactions";
import {
  DEFAULT_HORIZON_MONTHS,
  ForecastBoardScreen,
  ForecastBoardSkeleton,
  ForecastErrorScreen,
} from "@/features/recurring-transactions/screens/forecast-board-screen";
import type { BudgetProjectionResult } from "@/features/recurring-transactions/types/budget-projection";

export interface ForecastRouteData {
  projection?: BudgetProjectionResult;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/forecast")({
  loader: async (): Promise<ForecastRouteData> => {
    const result = await getRecurringBudgetProjections({
      horizonMonths: DEFAULT_HORIZON_MONTHS,
      includePausedBudgets: false,
    });
    if (Result.isFailure(result)) {
      return { errorMessage: result.error.message };
    }
    return { projection: result.value };
  },
  pendingComponent: ForecastBoardSkeleton,
  component: CashFlowForecastPage,
});

function CashFlowForecastPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage || !result.projection) {
    return <ForecastErrorScreen message={result.errorMessage ?? "Projection unavailable"} />;
  }
  return <ForecastBoardScreen initialProjection={result.projection} />;
}
