import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/")({
  component: CashFlowOverviewPage,
});

function CashFlowOverviewPage() {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Cash flow</h1>
    </section>
  );
}
