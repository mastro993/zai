import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ScreenBase } from "@/components/screen-base";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  createRecurringTransaction,
  getRecurringTransactions,
} from "../commands/recurring-transactions";
import { RecurringCreateDrawer } from "../components/recurring-create-drawer";
import { RecurringOccurrenceCard } from "../components/recurring-occurrence-card";
import type { RecurringFeedItem, RecurringFormValues } from "../types/recurring-transaction";

interface RecurringScreenProps {
  initialItems: Array<RecurringFeedItem>;
  initialNextCursor?: string | null;
  categories: Array<TransactionCategory>;
}

export function RecurringErrorScreen({ message }: { message: string }) {
  return (
    <ScreenBase>
      <div role="alert" className="text-sm text-destructive">
        {message}
      </div>
    </ScreenBase>
  );
}

export function RecurringScreen({
  initialItems,
  initialNextCursor,
  categories,
}: RecurringScreenProps) {
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string>();

  const refreshFeed = async () => {
    const result = await getRecurringTransactions();
    if (Result.isFailure(result)) {
      setFeedError(result.error.message);
      return;
    }
    setFeedError(undefined);
    setItems(result.value.items);
    setNextCursor(result.value.nextCursor);
  };

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    const result = await getRecurringTransactions(50, nextCursor);
    if (Result.isFailure(result)) {
      setFeedError(result.error.message);
      setIsLoadingMore(false);
      return;
    }
    setItems((current) => [...current, ...result.value.items]);
    setNextCursor(result.value.nextCursor);
    setIsLoadingMore(false);
  };

  const submitCreate = async (values: RecurringFormValues) => {
    const result = await createRecurringTransaction(values);
    if (Result.isSuccess(result)) {
      await refreshFeed();
    }
    return result;
  };

  return (
    <ScreenBase
      actions={
        <Button ref={createButtonRef} onClick={() => setIsCreateOpen(true)}>
          New recurring
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring transactions</h1>
          <p className="text-sm text-muted-foreground">
            Create schedules and browse upcoming occurrence cards.
          </p>
        </div>

        {feedError ? (
          <p role="alert" className="text-sm text-destructive">
            {feedError}
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring transactions yet. Create one to start scheduling cash flow.
          </p>
        ) : (
          <div role="feed" aria-label="Recurring transactions">
            {items.map((item) => (
              <RecurringOccurrenceCard key={item.recurringTransaction.id} item={item} />
            ))}
          </div>
        )}

        {nextCursor ? (
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        ) : null}
      </div>

      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <RecurringCreateDrawer
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={submitCreate}
          categories={categories}
          returnFocusRef={createButtonRef}
        />
      </Drawer>
    </ScreenBase>
  );
}
