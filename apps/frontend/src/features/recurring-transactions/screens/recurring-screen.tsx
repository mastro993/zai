import { RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer } from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScreenBase } from "@/components/screen-base";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  executeRecurringBulk,
  createRecurringTransaction,
  getMatchingRecurringTransactionIds,
  preflightRecurringBulk,
} from "../commands/recurring-transactions";
import { RecurringBulkResultDialog } from "../components/recurring-bulk-result-dialog";
import { RecurringBulkReviewDialog } from "../components/recurring-bulk-review-dialog";
import { RecurringFeedFiltersBar } from "../components/recurring-feed-filters";
import { RecurringFormDrawer } from "../components/recurring-form-drawer";
import { RecurringOccurrenceCard } from "../components/recurring-occurrence-card";
import { RecurringSelectionBar } from "../components/recurring-selection-bar";
import { useRecurringFeedReconciliation } from "../hooks/use-recurring-feed-reconciliation";
import { useRecurringSelectionContext } from "../hooks/recurring-selection-context";
import {
  getPageCheckboxState,
  buildRecurringBulkItems,
  retainAfterPartialSuccess,
  shouldShowSelectAllMatching,
} from "../lib/recurring-selection";
import type {
  RecurringBulkAction,
  RecurringBulkExecuteResult,
  RecurringBulkItem,
  RecurringBulkPreflight,
} from "../types/recurring-bulk";
import type {
  RecurringFeedFilters,
  RecurringFeedItem,
  RecurringFormValues,
} from "../types/recurring-transaction";

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [feedFilters, setFeedFilters] = useState<RecurringFeedFilters>({});
  const [bulkError, setBulkError] = useState<string>();
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<RecurringBulkAction | null>(null);
  const [pendingItems, setPendingItems] = useState<Array<RecurringBulkItem> | null>(null);
  const [preflight, setPreflight] = useState<RecurringBulkPreflight | null>(null);
  const [bulkResult, setBulkResult] = useState<RecurringBulkExecuteResult | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const filterRequestSequence = useRef(0);
  const selection = useRecurringSelectionContext();
  const {
    items,
    nextCursor,
    feedError,
    reconciliationError,
    subscriptionError,
    refreshFeed,
    loadMoreFeed,
    reportReconciliationError,
  } = useRecurringFeedReconciliation({
    initialItems,
    initialNextCursor,
    filters: feedFilters,
  });
  const selectableItems = items.map((item) => ({
    id: item.recurringTransaction.id,
    revision: item.recurringTransaction.revision,
  }));
  const pageCheckboxState = getPageCheckboxState(selectableItems, selection.selectedIds);
  const hiddenCount = [...selection.selectedIds].filter(
    (id) => !selectableItems.some((item) => item.id === id),
  ).length;
  const selectionLocked = isBulkBusy || pendingItems !== null;
  const hasActiveFeedFilters = Boolean(
    feedFilters.search || feedFilters.lifecycle || feedFilters.needsAttention !== undefined,
  );
  const showFilters = items.length > 0 || hasActiveFeedFilters || isFiltering;
  const showSelectAllMatching = shouldShowSelectAllMatching(
    pageCheckboxState,
    Boolean(nextCursor) || hiddenCount > 0 || items.length < selection.selectedCount,
    selection.selectAllMatching,
  );
  const loadMore = async () => {
    if (!nextCursor || isLoadingMore || isFiltering || selectionLocked || feedError) {
      return;
    }
    setIsLoadingMore(true);
    await loadMoreFeed(nextCursor);
    setIsLoadingMore(false);
  };
  const submitCreate = async (values: RecurringFormValues) => {
    const result = await createRecurringTransaction(values);
    if (Result.isSuccess(result)) {
      const refreshed = await refreshFeed();
      if (!refreshed) {
        reportReconciliationError(
          "Recurring transaction created, but feed refresh failed. Retry refresh without repeating creation.",
        );
      }
    }
    return result;
  };
  const startBulkAction = async (action: RecurringBulkAction) => {
    setBulkError(undefined);
    const itemsForRequest = buildRecurringBulkItems(selection.selectedIds, selection.revisionsById);
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
    setPendingItems(itemsForRequest);
    setPreflight(result.value);
  };
  const confirmBulkAction = async () => {
    if (!pendingAction || !pendingItems || !preflight) {
      return;
    }
    setIsBulkBusy(true);
    const result = await executeRecurringBulk(pendingAction, pendingItems);
    if (Result.isFailure(result)) {
      setIsBulkBusy(false);
      setBulkError(result.error.message);
      setPendingAction(null);
      setPendingItems(null);
      setPreflight(null);
      return;
    }
    const refreshed = await refreshFeed();
    setIsBulkBusy(false);
    setPendingAction(null);
    setPendingItems(null);
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
    const result = await getMatchingRecurringTransactionIds(feedFilters);
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
      result.value.fingerprint,
    );
  };
  const changeFeedFilters = async (filters: RecurringFeedFilters) => {
    const requestId = ++filterRequestSequence.current;
    setFeedFilters(filters);
    setIsFiltering(true);
    const refreshed = await refreshFeed(filters);
    if (requestId !== filterRequestSequence.current) {
      return;
    }
    setIsFiltering(false);
    if (!refreshed) {
      reportReconciliationError(
        "Recurring filter refresh failed. Existing selection remains unchanged; retry the filter.",
      );
    }
  };
  const renderCard = (item: RecurringFeedItem) => (
    <RecurringOccurrenceCard
      key={item.recurringTransaction.id}
      item={item}
      selected={selection.selectedIds.has(item.recurringTransaction.id)}
      disabled={selectionLocked}
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
        showFilters ? (
          <Button ref={createButtonRef} size="sm" onClick={() => setIsCreateOpen(true)}>
            New recurring
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {showFilters ? (
          <RecurringFeedFiltersBar
            filters={feedFilters}
            disabled={selectionLocked}
            onChange={changeFeedFilters}
          />
        ) : null}
        {isFiltering ? (
          <p className="text-sm text-muted-foreground" role="status">
            Filtering recurring transactions...
          </p>
        ) : null}

        <RecurringSelectionBar
          selectedCount={selection.selectedCount}
          hiddenCount={hiddenCount}
          frozenFilterFingerprint={selection.frozenFilterFingerprint}
          isBusy={selectionLocked}
          onAction={startBulkAction}
          onClearSelection={selection.clearSelection}
        />

        {items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={pageCheckboxState === "all"}
                data-indeterminate={pageCheckboxState === "some" ? true : undefined}
                disabled={selectionLocked}
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
                disabled={selectionLocked}
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

        {bulkError ? (
          <p role="alert" className="text-sm text-destructive">
            {bulkError}
          </p>
        ) : null}
        {feedError ? (
          <p role="alert" className="text-sm text-destructive">
            {feedError}
          </p>
        ) : null}
        {reconciliationError ? (
          <p role="alert" className="text-sm text-destructive">
            {reconciliationError}
          </p>
        ) : null}
        {subscriptionError ? (
          <p role="status" className="text-sm text-muted-foreground">
            Live recurring updates unavailable. Durable state will refresh when the connection
            recovers or this window regains focus.
          </p>
        ) : null}

        {items.length === 0 ? (
          hasActiveFeedFilters ? (
            <Empty
              role="region"
              aria-label="No recurring transactions match your filters"
              className="flex-none gap-3 rounded-lg border p-6"
            >
              <EmptyHeader className="max-w-none gap-1.5">
                <EmptyDescription>No recurring transactions match your filters.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-none">
                <Button variant="outline" size="sm" onClick={() => void changeFeedFilters({})}>
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty
              role="region"
              aria-labelledby="recurring-empty-state-title"
              className="min-h-72 rounded-lg border px-6 py-10 sm:px-8"
            >
              <EmptyHeader className="max-w-md gap-1.5">
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={RepeatIcon} strokeWidth={2} aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle
                  id="recurring-empty-state-title"
                  role="heading"
                  aria-level={2}
                  className="text-base"
                >
                  No recurring transactions yet
                </EmptyTitle>
                <EmptyDescription>
                  Create your first recurring transaction to start scheduling cash flow.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-none flex-row flex-wrap justify-center">
                <Button ref={createButtonRef} onClick={() => setIsCreateOpen(true)}>
                  New recurring
                </Button>
              </EmptyContent>
            </Empty>
          )
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
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore || isFiltering || selectionLocked || Boolean(feedError)}
          >
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
            setPendingItems(null);
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
