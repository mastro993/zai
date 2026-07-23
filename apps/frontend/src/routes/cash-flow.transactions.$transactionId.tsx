import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getTransactionCategories } from "@/features/categories/commands/transaction-categories";
import { getTransactionRecurringProvenance } from "@/features/recurring-transactions/commands/recurring-transactions";
import {
  TransactionDetailScreen,
  TransactionErrorScreen,
} from "@/features/transactions/screens/transaction-detail-screen";
import type { TransactionRecurringProvenance } from "@/features/recurring-transactions/types/recurring-transaction";
import { getTransaction } from "@/features/transactions/commands/transactions";
import type { Transaction } from "@/features/transactions/types/model";
import type { TransactionCategory } from "@/features/categories/types/model";

export interface TransactionDetailRouteData {
  transaction?: Transaction;
  categories?: Array<TransactionCategory>;
  recurringProvenance?: TransactionRecurringProvenance | null;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/transactions/$transactionId")({
  loader: async ({ params }): Promise<TransactionDetailRouteData> => {
    const [transactionResult, categoriesResult, provenanceResult] = await Promise.all([
      getTransaction(params.transactionId),
      getTransactionCategories(),
      getTransactionRecurringProvenance(params.transactionId),
    ]);

    if (Result.isFailure(transactionResult)) {
      return { errorMessage: transactionResult.error.message };
    }
    if (Result.isFailure(categoriesResult)) {
      return { errorMessage: categoriesResult.error.message };
    }
    if (Result.isFailure(provenanceResult)) {
      return { errorMessage: provenanceResult.error.message };
    }

    return {
      transaction: transactionResult.value,
      categories: categoriesResult.value,
      recurringProvenance: provenanceResult.value,
    };
  },
  component: CashFlowTransactionDetailPage,
});

function CashFlowTransactionDetailPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage) {
    return <TransactionErrorScreen message={result.errorMessage} />;
  }
  if (!result.transaction) {
    return <TransactionErrorScreen message="Transaction could not be loaded" />;
  }

  return (
    <TransactionDetailScreen
      transaction={result.transaction}
      categories={result.categories ?? []}
      recurringProvenance={result.recurringProvenance ?? null}
    />
  );
}
