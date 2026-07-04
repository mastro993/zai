import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/categories")({
  component: CashFlowCategoriesPage,
});

function CashFlowCategoriesPage() {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Categories</h1>
    </section>
  );
}
