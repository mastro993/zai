import { TransactionCategoriesScreen } from "@/features/transaction-category/screens/TransactionCategoriesScreen";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/categories/")({
  component: TransactionCategoriesScreen,
});
