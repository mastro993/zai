import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer } from "@/components/ui/drawer";
import { ScreenBase } from "@/components/screen-base";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  executeRecurringBulk,
  createRecurringTransaction,
  getMatchingRecurringTransactionIds,
  getRecurringProcessingStatus,
  getRecurringTransactions,
  preflightRecurringBulk,
} from "../commands/recurring-transactions";
import { RecurringBulkResultDialog } from "../components/recurring-bulk-result-dialog";
import { RecurringBulkReviewDialog } from "../components/recurring-bulk-review-dialog";
import { RecurringFormDrawer } from "../components/recurring-form-drawer";
import { RecurringOccurrenceCard } from "../components/recurring-occurrence-card";
import { RecurringSelectionBar } from "../components/recurring-selection-bar";
import { useRecurringProcessingLiveEvents } from "../hooks/use-recurring-processing-live-events";
import { useRecurringSelectionContext } from "../hooks/recurring-selection-context";
import {
  getPageCheckboxState,
  retainAfterPartialSuccess,
  shouldShowSelectAllMatching,
} from "../lib/recurring-selection";
import type {
  RecurringBulkAction,
  RecurringBulkExecuteResult,
  RecurringBulkItem,
  RecurringBulkPreflight,
} from "../types/recurring-bulk";
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
  const [bulkError, setBulkError] = useState<string>();
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<RecurringBulkAction | null>(null);
  const [preflight, setPreflight] = useState<RecurringBulkPreflight | null>(null);
  const [bulkResult, setBulkResult] = useState<RecurringBulkExecuteResult | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const selection = useRecurringSelectionContext();
  const selectableItems = items.map((item) => ({
    id: item.recurringTransaction.id,
    revision: item.recurringTransaction.revision,
  }));
  const pageCheckboxState = getPageCheckboxState(selectableItems, selection.selectedIds);
  const hiddenCount = [...selection.selectedIds].filter(
    (id) => !selectableItems.some((item) => item.id === id),
  ).length;
  const showSelectAllMatching = shouldShowSelectAllMatching(
    pageCheckboxState,
    Boolean(nextCursor) || hiddenCount > 0 || items.length < selection.selectedCount,
    selection.selectAllMatching,
  );

  const selectedItems = (): Array<RecurringBulkItem> =>
    [...selection.selectedIds].flatMap((id) => {
      const revision = selection.revisionsById.get(id);
      if (!revision) {
        return [];
      }
      return [{ recurringTransactionId: id, expectedRevision: revision }];
    });

  const refreshFeed = async (): Promise<boolean> => {
    const result = await getRecurringTransactions();
    if (Result.isFailure(result)) {
      setFeedError(result.error.message);
      return false;
    }
    setFeedError(undefined);
    setItems(result.value.items);
    setNextCursor(result.value.nextCursor);
    selection.rememberRevisions(
      result.value.items.map((item) => ({
        id: item.recurringTransaction.id,
        revision: item.recurringTransaction.revision,
      })),
    );
    return true;
  };

  const reconcileFromDurableState = () => {
    void Promise.allSettled([getRecurringProcessingStatus(), refreshFeed()]);
  };

  useRecurringProcessingLiveEvents({
    onReconcile: reconcileFromDurableState,
    onReady: reconcileFromDurableState,
  });

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
    selection.rememberRevisions(
      result.value.items.map((item) => ({
        id: item.recurringTransaction.id,
        revision: item.recurringTransaction.revision,
      })),
    );
    setIsLoadingMore(false);
  };

  const submitCreate = async (values: RecurringFormValues) => {
    const result = await createRecurringTransaction(values);
    if (Result.isSuccess(result)) {
      await refreshFeed();
    }
    return result;
  };

  const startBulkAction = async (action: RecurringBulkAction) => {
    setBulkError(undefined);
    const itemsForRequest = selectedItems();
    if (itemsForRequest.length === 0) {
      setBulkError("Selected items are missing revision data. Clear selection and try again.");
      return;
    }
    setIsBulkBusy(true);
    const result = await preflightRecurringBulk(action, itemsForRequest);
    setIsBulkBusy(false);
    if (Result.isFailure(result)) {
      setBulkError(result.error.message);
      return;
    }
    setPendingAction(action);
    setPreflight(result.value);
  };

  const confirmBulkAction = async () => {
    if (!pendingAction || !preflight) {
      return;
    }
    setIsBulkBusy(true);
    const result = await executeRecurringBulk(pendingAction, selectedItems());
    if (Result.isFailure(result)) {
      setIsBulkBusy(false);
      setBulkError(result.error.message);
      setPendingAction(null);
      setPreflight(null);
      return;
    }

    const refreshed = await refreshFeed();
    setIsBulkBusy(false);
    setPendingAction(null);
    setPreflight(null);
    setBulkResult(result.value);
    setRefreshFailed(!refreshed);

    if (result.value.unchanged === 0 && result.value.failed === 0 && refreshed) {
      selection.clearSelection();
      setBulkResult(null);
      setResultOpen(false);
      return;
    }

    selection.setSelectedIds(
      retainAfterPartialSuccess(selection.selectedIds, result.value.results),
    );
    setResultOpen(true);
  };

  const selectAllMatching = async () => {
    setIsBulkBusy(true);
    const result = await getMatchingRecurringTransactionIds();
    setIsBulkBusy(false);
    if (Result.isFailure(result)) {
      setBulkError(result.error.message);
      return;
    }
    selection.applySelectAllMatching(
      result.value.items.map((item) => ({
        id: item.recurringTransactionId,
        revision: item.expectedRevision,
      })),
    );
  };

  const renderCard = (item: RecurringFeedItem) => (
    <RecurringOccurrenceCard
      key={item.recurringTransaction.id}
      item={item}
      selected={selection.selectedIds.has(item.recurringTransaction.id)}
      onSelectedChange={(selected) =>
        selection.toggleRow(
          {
            id: item.recurringTransaction.id,
            revision: item.recurringTransaction.revision,
          },
          selected,
        )
      }
    />
  );

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

        <RecurringSelectionBar
          selectedCount={selection.selectedCount}
          hiddenCount={hiddenCount}
          isBusy={isBulkBusy}
          onAction={startBulkAction}
          onClearSelection={selection.clearSelection}
        />

        {items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={pageCheckboxState === "all"}
                data-indeterminate={pageCheckboxState === "some" ? true : undefined}
                onCheckedChange={(value) => selection.togglePage(selectableItems, value === true)}
                aria-label="Select all on this page"
              />
              Select page
            </label>
            {showSelectAllMatching ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                disabled={isBulkBusy}
                onClick={selectAllMatching}
              >
                Select all matching
              </Button>
            ) : null}
            {selection.selectAllMatching ? (
              <span className="text-sm text-muted-foreground">All matching selected</span>
            ) : null}
          </div>
        ) : null}

        {feedError || bulkError ? (
          <p role="alert" className="text-sm text-destructive">
            {bulkError ?? feedError}
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring transactions yet. Create one to start scheduling cash flow.
          </p>
        ) : (
          <>
            {items.some((item) => item.needsAttention) ? (
              <section className="space-y-2" aria-label="Needs attention">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium">Needs attention</h2>
                  <Badge variant="destructive">
                    {items.filter((item) => item.needsAttention).length}
                  </Badge>
                </div>
                <div role="feed" aria-label="Recurring transactions needing attention">
                  {items.filter((item) => item.needsAttention).map(renderCard)}
                </div>
              </section>
            ) : null}
            <div role="feed" aria-label="Recurring transactions">
              {items.filter((item) => !item.needsAttention).map(renderCard)}
            </div>
          </>
        )}

        {nextCursor ? (
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        ) : null}
      </div>

      <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen} swipeDirection="right">
        <RecurringFormDrawer
          mode={{ type: "create" }}
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={submitCreate}
          categories={categories}
          returnFocusRef={createButtonRef}
        />
      </Drawer>

      <RecurringBulkReviewDialog
        open={pendingAction !== null && preflight !== null}
        action={pendingAction}
        preflight={preflight}
        isPending={isBulkBusy}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setPreflight(null);
          }
        }}
        onConfirm={confirmBulkAction}
      />

      <RecurringBulkResultDialog
        open={resultOpen}
        result={bulkResult}
        labels={
          new Map(items.map((item) => [item.recurringTransaction.id, item.description] as const))
        }
        refreshFailed={refreshFailed}
        onOpenChange={setResultOpen}
        onRetryRefresh={async () => {
          const refreshed = await refreshFeed();
          setRefreshFailed(!refreshed);
          if (refreshed && bulkResult && bulkResult.unchanged === 0 && bulkResult.failed === 0) {
            selection.clearSelection();
            setResultOpen(false);
          }
        }}
      />
    </ScreenBase>
  );
}
