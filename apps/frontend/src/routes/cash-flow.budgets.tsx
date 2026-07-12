import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getBudgets } from "@/features/cash-flow/commands/budgets";
import { BudgetErrorScreen, BudgetScreen } from "@/features/cash-flow/screens/budget-screen";
import type { Budget } from "@/features/cash-flow/types/budget";

export interface BudgetRouteData {
  budgets?: Array<Budget>;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/budgets")({
  loader: async (): Promise<BudgetRouteData> => {
    const result = await getBudgets();
    if (Result.isFailure(result)) {
      return { errorMessage: result.error.message };
    }
    return { budgets: result.value };
  },
  component: CashFlowBudgetsPage,
});

function CashFlowBudgetsPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage) {
    return <BudgetErrorScreen message={result.errorMessage} />;
  }
  return <BudgetScreen initialBudgets={result.budgets ?? []} />;
}
