import { TransactionsScreen } from "@/features/transaction/screens/TransactionsScreen";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/")({
  component: TransactionsScreen,
});
