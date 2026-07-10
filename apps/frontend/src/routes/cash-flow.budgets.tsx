import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getBudgets } from "@/features/cash-flow/commands/budgets";
import { getTransactionCategories } from "@/features/cash-flow/commands/transaction-categories";
import { BudgetScreen } from "@/features/cash-flow/screens/budget-screen";

export const Route = createFileRoute("/cash-flow/budgets")({
  loader: async () => {
    const [budgetsResult, categoriesResult] = await Promise.all([
      getBudgets("active"),
      getTransactionCategories(),
    ]);

    if (Result.isFailure(budgetsResult)) {
      throw budgetsResult.error;
    }

    if (Result.isFailure(categoriesResult)) {
      throw categoriesResult.error;
    }

    return {
      budgets: budgetsResult.value,
      categories: categoriesResult.value,
    };
  },
  component: CashFlowBudgetsPage,
});

function CashFlowBudgetsPage() {
  const { budgets, categories } = Route.useLoaderData();

  return <BudgetScreen initialBudgets={budgets} categories={categories} />;
}
