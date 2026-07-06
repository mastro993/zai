import { createFileRoute } from "@tanstack/react-router";

import { TransactionScreen } from "@/features/cash-flow/screens/transaction-screen";

export const Route = createFileRoute("/cash-flow/transactions")({
  component: CashFlowTransactionsPage,
});

function CashFlowTransactionsPage() {
  return <TransactionScreen />;
}
