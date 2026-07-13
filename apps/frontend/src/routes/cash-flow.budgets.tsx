import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/budgets")({
  component: CashFlowBudgetsLayout,
});

function CashFlowBudgetsLayout() {
  return <Outlet />;
}
