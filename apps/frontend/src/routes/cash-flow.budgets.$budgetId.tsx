import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getBudget } from "@/features/cash-flow/commands/budgets";
import { BudgetDetailScreen } from "@/features/cash-flow/screens/budget-detail-screen";
import { BudgetErrorScreen } from "@/features/cash-flow/screens/budget-screen";
import type { Budget } from "@/features/cash-flow/types/budget";

export interface BudgetDetailRouteData {
  budget?: Budget;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/budgets/$budgetId")({
  loader: async ({ params }): Promise<BudgetDetailRouteData> => {
    const result = await getBudget(params.budgetId);
    if (Result.isFailure(result)) {
      return { errorMessage: result.error.message };
    }
    return { budget: result.value };
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
  return <BudgetDetailScreen budget={result.budget} />;
}
