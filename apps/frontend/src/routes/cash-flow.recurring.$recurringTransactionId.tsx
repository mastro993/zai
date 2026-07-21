import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getRecurringTransaction } from "@/features/recurring-transactions/commands/recurring-transactions";
import { RecurringDocumentScreen } from "@/features/recurring-transactions/screens/recurring-document-screen";
import { RecurringErrorScreen } from "@/features/recurring-transactions/screens/recurring-screen";
import type { RecurringTransactionDocument } from "@/features/recurring-transactions/types/recurring-transaction";

export interface RecurringDocumentRouteData {
  document?: RecurringTransactionDocument;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/recurring/$recurringTransactionId")({
  loader: async ({ params }): Promise<RecurringDocumentRouteData> => {
    const result = await getRecurringTransaction(params.recurringTransactionId);
    if (Result.isFailure(result)) {
      return { errorMessage: result.error.message };
    }
    return { document: result.value };
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
  return <RecurringDocumentScreen document={result.document} />;
}
