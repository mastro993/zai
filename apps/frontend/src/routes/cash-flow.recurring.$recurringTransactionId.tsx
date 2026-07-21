import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getTransactionCategories } from "@/features/categories/commands/transaction-categories";
import { getRecurringTransaction } from "@/features/recurring-transactions/commands/recurring-transactions";
import { RecurringDocumentScreen } from "@/features/recurring-transactions/screens/recurring-document-screen";
import { RecurringErrorScreen } from "@/features/recurring-transactions/screens/recurring-screen";
import type { RecurringTransactionDocument } from "@/features/recurring-transactions/types/recurring-transaction";
import type { TransactionCategory } from "@/features/categories/types/model";

export interface RecurringDocumentRouteData {
  document?: RecurringTransactionDocument;
  categories?: Array<TransactionCategory>;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/recurring/$recurringTransactionId")({
  loader: async ({ params }): Promise<RecurringDocumentRouteData> => {
    const [documentResult, categoriesResult] = await Promise.all([
      getRecurringTransaction(params.recurringTransactionId),
      getTransactionCategories(),
    ]);
    if (Result.isFailure(documentResult)) {
      return { errorMessage: documentResult.error.message };
    }
    if (Result.isFailure(categoriesResult)) {
      return { errorMessage: categoriesResult.error.message };
    }
    return {
      document: documentResult.value,
      categories: categoriesResult.value,
    };
  },
  component: CashFlowRecurringDocumentPage,
});

function CashFlowRecurringDocumentPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage) {
    return <RecurringErrorScreen message={result.errorMessage} />;
  }
  if (!result.document) {
    return <RecurringErrorScreen message="Recurring transaction could not be loaded" />;
  }
  return (
    <RecurringDocumentScreen document={result.document} categories={result.categories ?? []} />
  );
}
