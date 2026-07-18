import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getBudget, getBudgetHistory } from "@/features/budgets/commands/budgets";
import { getTransactionCategories } from "@/features/categories/commands/transaction-categories";
import { BudgetDetailScreen } from "@/features/budgets/screens/budget-detail-screen";
import { BudgetErrorScreen } from "@/features/budgets/screens/budget-screen";
import type { Budget, BudgetHistory } from "@/features/budgets/types/budget";
import type { TransactionCategory } from "@/features/categories/types/model";

export interface BudgetDetailRouteData {
  budget?: Budget;
  history?: BudgetHistory;
  categories?: Array<TransactionCategory>;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/budgets/$budgetId")({
  loader: async ({ params }): Promise<BudgetDetailRouteData> => {
    const budgetResult = await getBudget(params.budgetId);
    if (Result.isFailure(budgetResult)) {
      return { errorMessage: budgetResult.error.message };
    }
    const [historyResult, categoriesResult] = await Promise.all([
      getBudgetHistory(params.budgetId),
      getTransactionCategories(),
    ]);
    if (Result.isFailure(historyResult)) {
      return { errorMessage: historyResult.error.message };
    }
    if (Result.isFailure(categoriesResult)) {
      return { errorMessage: categoriesResult.error.message };
    }
    return {
      budget: budgetResult.value,
      history: historyResult.value,
      categories: categoriesResult.value,
    };
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
  return (
    <BudgetDetailScreen
      budget={result.budget}
      history={result.history}
      categories={result.categories ?? []}
    />
  );
}
