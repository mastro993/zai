import { createFileRoute } from "@tanstack/react-router";

import { TransactionManager } from "@/features/cash-flow/transaction-manager";

export const Route = createFileRoute("/cash-flow/transactions")({
  component: CashFlowTransactionsPage,
});

function CashFlowTransactionsPage() {
  return <TransactionManager />;
}
