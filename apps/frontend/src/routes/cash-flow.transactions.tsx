import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getTransactionCategories } from "@/features/cash-flow/commands/transaction-categories";
import { getTransactions } from "@/features/cash-flow/commands/transactions";
import { DEFAULT_TRANSACTION_ROWS_PER_PAGE } from "@/features/cash-flow/lib/pagination";
import { TransactionScreen } from "@/features/cash-flow/screens/transaction-screen";

export const Route = createFileRoute("/cash-flow/transactions")({
  loader: async () => {
    const [transactionsResult, categoriesResult] = await Promise.all([
      getTransactions(1, DEFAULT_TRANSACTION_ROWS_PER_PAGE),
      getTransactionCategories(),
    ]);

    if (Result.isFailure(transactionsResult)) {
      throw transactionsResult.error;
    }

    if (Result.isFailure(categoriesResult)) {
      throw categoriesResult.error;
    }

    return {
      transactions: transactionsResult.value,
      categories: categoriesResult.value,
    };
  },
  component: CashFlowTransactionsPage,
});

function CashFlowTransactionsPage() {
  const { transactions, categories } = Route.useLoaderData();

  return <TransactionScreen initialData={{ transactions, categories }} />;
}
