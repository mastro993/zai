import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getBudget, getBudgetHistory } from "@/features/cash-flow/commands/budgets";
import { BudgetDetailScreen } from "@/features/cash-flow/screens/budget-detail-screen";
import { BudgetErrorScreen } from "@/features/cash-flow/screens/budget-screen";
import type { Budget, BudgetHistory } from "@/features/cash-flow/types/budget";

export interface BudgetDetailRouteData {
  budget?: Budget;
  history?: BudgetHistory;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/budgets/$budgetId")({
  loader: async ({ params }): Promise<BudgetDetailRouteData> => {
    const budgetResult = await getBudget(params.budgetId);
    if (Result.isFailure(budgetResult)) {
      return { errorMessage: budgetResult.error.message };
    }
    const historyResult = await getBudgetHistory(params.budgetId);
    if (Result.isFailure(historyResult)) {
      return { errorMessage: historyResult.error.message };
    }
    return { budget: budgetResult.value, history: historyResult.value };
  },
  component: CashFlowBudgetDetailPage,
});

function CashFlowBudgetDetailPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage) {
    return <BudgetErrorScreen message={result.errorMessage} />;
  }
  if (!result.budget) {
    return <BudgetErrorScreen message="Budget could not be loaded" />;
  }
  if (!result.history) {
    return <BudgetErrorScreen message="Budget history could not be loaded" />;
  }
  return <BudgetDetailScreen budget={result.budget} history={result.history} />;
}
