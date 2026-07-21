import { Result } from "@praha/byethrow";
import { createFileRoute } from "@tanstack/react-router";

import { getTransactionCategories } from "@/features/categories/commands/transaction-categories";
import { getRecurringTransactions } from "@/features/recurring-transactions/commands/recurring-transactions";
import {
  RecurringErrorScreen,
  RecurringScreen,
} from "@/features/recurring-transactions/screens/recurring-screen";
import type { RecurringFeedItem } from "@/features/recurring-transactions/types/recurring-transaction";
import type { TransactionCategory } from "@/features/categories/types/model";

export interface RecurringRouteData {
  items?: Array<RecurringFeedItem>;
  nextCursor?: string | null;
  categories?: Array<TransactionCategory>;
  errorMessage?: string;
}

export const Route = createFileRoute("/cash-flow/recurring/")({
  loader: async (): Promise<RecurringRouteData> => {
    const [feedResult, categoriesResult] = await Promise.all([
      getRecurringTransactions(),
      getTransactionCategories(),
    ]);
    if (Result.isFailure(feedResult)) {
      return { errorMessage: feedResult.error.message };
    }
    if (Result.isFailure(categoriesResult)) {
      return { errorMessage: categoriesResult.error.message };
    }
    return {
      items: feedResult.value.items,
      nextCursor: feedResult.value.nextCursor,
      categories: categoriesResult.value,
    };
  },
  component: CashFlowRecurringPage,
});

function CashFlowRecurringPage() {
  const result = Route.useLoaderData();
  if (result.errorMessage) {
    return <RecurringErrorScreen message={result.errorMessage} />;
  }
  return (
    <RecurringScreen
      initialItems={result.items ?? []}
      initialNextCursor={result.nextCursor}
      categories={result.categories ?? []}
    />
  );
}
