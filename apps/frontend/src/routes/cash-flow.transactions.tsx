import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/transactions")({
  component: CashFlowTransactionsLayout,
});

function CashFlowTransactionsLayout() {
  return <Outlet />;
}
