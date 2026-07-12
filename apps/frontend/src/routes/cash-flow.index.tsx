import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/")({
  component: CashFlowOverviewPage,
});

function CashFlowOverviewPage() {
  return <Navigate to="/cash-flow/budgets" replace />;
}
