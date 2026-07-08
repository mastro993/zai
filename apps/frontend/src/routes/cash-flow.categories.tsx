import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getTransactionCategories } from "@/features/cash-flow/commands/transaction-categories";
import { CategoryScreen } from "@/features/cash-flow/screens/category-screen";

export const Route = createFileRoute("/cash-flow/categories")({
  loader: async () => {
    const categoriesResult = await getTransactionCategories();

    if (Result.isFailure(categoriesResult)) {
      throw categoriesResult.error;
    }

    return {
      categories: categoriesResult.value,
    };
  },
  component: CashFlowCategoriesPage,
});

function CashFlowCategoriesPage() {
  const { categories } = Route.useLoaderData();

  return <CategoryScreen initialCategories={categories} />;
}
