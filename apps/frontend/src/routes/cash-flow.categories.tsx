import { createFileRoute } from "@tanstack/react-router";

import { CategoryManager } from "@/features/cash-flow/category-manager";

export const Route = createFileRoute("/cash-flow/categories")({
  component: CashFlowCategoriesPage,
});

function CashFlowCategoriesPage() {
  return <CategoryManager />;
}
