import { createFileRoute } from "@tanstack/react-router";

import { CategoryScreen } from "@/features/cash-flow/screens/category-screen";

export const Route = createFileRoute("/cash-flow/categories")({
  component: CashFlowCategoriesPage,
});

function CashFlowCategoriesPage() {
  return <CategoryScreen />;
}
