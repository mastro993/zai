import { DownloadIcon, TransactionHistoryIcon, UploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "@/components/toaster/toast";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Drawer } from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { TransactionBulkDeleteDialog } from "../components/transaction-bulk-delete-dialog";
import { TransactionCategoryFilter } from "../components/transaction-category-filter";
import { TransactionDateFilter } from "../components/transaction-date-filter";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionImportDialog } from "../components/transaction-import-dialog";
import { TransactionList } from "../components/transaction-list";
import { TransactionPagination } from "../components/transaction-pagination";
import { TransactionSelectionBar } from "../components/transaction-selection-bar";
import { TransactionTypeFilter } from "../components/transaction-type-filter";
import { RecurringFormDrawer } from "@/features/recurring-transactions/components/recurring-form-drawer";
import { useTransactionActions } from "../hooks/use-transaction-actions";
import {
  useTransactionListController,
  type TransactionScreenInitialData,
} from "../hooks/use-transaction-list-controller";

interface TransactionScreenProps {
  initialData: TransactionScreenInitialData;
}

export function TransactionScreen({ initialData }: TransactionScreenProps) {
  const controller = useTransactionListController(initialData);
  const actions = useTransactionActions(controller);
  const showFilters = controller.transactions.length > 0 || controller.hasActiveFilters;
  const importTransactionsButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Import transactions"
      onClick={() => actions.setIsImportDialogOpen(true)}
    >
      <HugeiconsIcon icon={UploadIcon} strokeWidth={2} />
    </Button>
  );
  const exportTransactionsLabel = actions.isExporting
    ? actions.selectedCount > 0
      ? "Exporting selected transactions"
      : "Exporting transactions"
    : actions.selectedCount > 0
      ? "Export selected transactions"
      : "Export transactions";
  const exportTransactionsButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={exportTransactionsLabel}
      aria-busy={actions.isExporting}
      disabled={
        controller.isLoading ||
        actions.isExporting ||
        (actions.selectedCount === 0 && controller.transactions.length === 0)
      }
      onClick={actions.exportTransactionCsv}
    >
      <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
    </Button>
  );

  return (
    <ScreenBase
      actions={
        <>
          {showFilters ? (
            <TooltipProvider>
              <ButtonGroup aria-label="Transaction file actions">
                <Tooltip>
                  <TooltipTrigger render={importTransactionsButton} />
                  <TooltipContent>Import transactions</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={exportTransactionsButton} />
                  <TooltipContent>{exportTransactionsLabel}</TooltipContent>
                </Tooltip>
              </ButtonGroup>
            </TooltipProvider>
          ) : null}
          {showFilters ? (
            <Button size="sm" onClick={() => actions.openFormDrawer({ type: "create" })}>
              New transaction
            </Button>
          ) : null}
        </>
      }
    >
      {showFilters ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TransactionSelectionBar
            selectedCount={actions.selectedCount}
            isDeleting={actions.isBulkDeleting}
            onDelete={() => actions.setIsBulkDeleteDialogOpen(true)}
            onClearSelection={actions.clearSelection}
          />
          <Input
            type="search"
            placeholder="Search description or notes..."
            value={controller.query}
            className="w-72"
            onChange={(event) => {
              controller.setQuery(event.target.value);
            }}
          />
          <TransactionDateFilter
            selection={controller.dateSelection}
            onSelectionChange={controller.changeDateSelection}
          />
          <TransactionTypeFilter
            selection={controller.typeSelection}
            onSelectionChange={controller.changeTypeSelection}
          />
          <TransactionCategoryFilter
            categories={controller.categories}
            selection={controller.categorySelection}
            isLoading={controller.isLoading && controller.categories.length === 0}
            onSelectionChange={controller.changeCategorySelection}
          />
        </div>
      ) : null}

      {controller.errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {controller.errorMessage}
        </div>
      ) : null}

      {actions.isSelectingAllMatching ? (
        <p className="text-sm text-muted-foreground">Selecting matching transactions...</p>
      ) : null}

      {controller.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading transactions...</p>
      ) : null}

      {!controller.isLoading && controller.transactions.length === 0 ? (
        controller.hasActiveFilters ? (
          <Empty
            role="region"
            aria-label="No transactions match your filters"
            className="flex-none gap-3 rounded-lg border p-6"
          >
            <EmptyHeader className="max-w-none gap-1.5">
              <EmptyDescription>No transactions match your filters.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-none">
              <Button variant="outline" size="sm" onClick={controller.clearFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty
            role="region"
            aria-labelledby="transaction-empty-state-title"
            className="min-h-72 rounded-lg border px-6 py-10 sm:px-8"
          >
            <EmptyHeader className="max-w-md gap-1.5">
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={TransactionHistoryIcon} strokeWidth={2} aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle
                id="transaction-empty-state-title"
                role="heading"
                aria-level={2}
                className="text-base"
              >
                No transactions yet
              </EmptyTitle>
              <EmptyDescription>
                Add income or an expense to start tracking cash flow.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-none flex-row flex-wrap justify-center">
              <Button onClick={() => actions.openFormDrawer({ type: "create" })}>
                New transaction
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => actions.setIsImportDialogOpen(true)}
              >
                <HugeiconsIcon icon={UploadIcon} strokeWidth={2} data-icon="inline-start" />
                Import transactions
              </Button>
            </EmptyContent>
          </Empty>
        )
      ) : null}

      {controller.transactions.length > 0 ? (
        <div className="flex flex-col gap-4">
          <TransactionList
            transactions={controller.transactions}
            categoryById={controller.categoryById}
            onEdit={(transactionId) => {
              void actions.openEditForm(transactionId);
            }}
            onAdopt={(transaction, trigger) => {
              void actions.openAdoptDrawer(transaction, trigger);
            }}
            onDelete={actions.openDeleteDialog}
          />
          <TransactionPagination
            page={controller.page}
            perPage={controller.perPage}
            totalPages={controller.totalPages}
            visibleCount={controller.transactions.length}
            onPageChange={controller.setPage}
            onPerPageChange={controller.changeRowsPerPage}
          />
        </div>
      ) : null}

      <TransactionDeleteConfirmationDialog
        transaction={actions.pendingDelete}
        open={actions.isDeleteDialogOpen}
        isDeleting={actions.isDeleting}
        onOpenChange={actions.setIsDeleteDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            actions.setPendingDelete(null);
          }
        }}
        onDelete={() => {
          if (actions.pendingDelete) {
            void actions.removeTransaction(actions.pendingDelete);
          }
        }}
      />

      <ConfirmationDialog
        open={actions.pendingManualRate !== null}
        onOpenChange={(open) => {
          if (!open) {
            actions.setPendingManualRate(null);
          }
        }}
        title="Replace the current exchange rate?"
        description={`This stores a manual exchange rate of ${actions.pendingManualRate?.manualExchangeRate ?? ""}. The previous supplied or manual origin is replaced and stays visible as manual.`}
      >
        <Button size="sm" onClick={() => void actions.confirmManualRateReplacement()}>
          Use manual rate
        </Button>
      </ConfirmationDialog>

      <TransactionBulkDeleteDialog
        selectedCount={actions.selectedCount}
        open={actions.isBulkDeleteDialogOpen}
        isDeleting={actions.isBulkDeleting}
        onOpenChange={actions.setIsBulkDeleteDialogOpen}
        onOpenChangeComplete={() => undefined}
        onDelete={() => {
          void actions.removeSelectedTransactions();
        }}
      />

      <TransactionImportDialog
        open={actions.isImportDialogOpen}
        categories={controller.categories}
        onOpenChange={actions.setIsImportDialogOpen}
        onImported={async (createdCount, skippedRows) => {
          await actions.refreshList(true);
          toast.success(`Imported ${createdCount} transactions`, {
            description:
              skippedRows > 0 ? `${skippedRows} rows were skipped during preview.` : undefined,
          });
        }}
      />

      <Drawer
        open={actions.isFormDrawerOpen}
        onOpenChange={actions.setIsFormDrawerOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            actions.setFormMode(null);
          }
        }}
        swipeDirection="right"
      >
        {actions.formMode ? (
          <TransactionFormDrawer
            key={actions.formMode.type === "edit" ? actions.formMode.transaction.id : "create"}
            mode={actions.formMode}
            categories={controller.categories}
            open={actions.isFormDrawerOpen}
            onSubmit={actions.submitTransaction}
            recurringProvenance={actions.editProvenance}
          />
        ) : null}
      </Drawer>

      <Drawer
        open={actions.isAdoptDrawerOpen}
        onOpenChange={actions.setIsAdoptDrawerOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            actions.setAdoptTransaction(null);
          }
        }}
        swipeDirection="right"
      >
        {actions.adoptTransaction ? (
          <RecurringFormDrawer
            key={actions.adoptTransaction.id}
            mode={{ type: "adopt", transaction: actions.adoptTransaction }}
            open={actions.isAdoptDrawerOpen}
            categories={controller.categories}
            onOpenChange={actions.setIsAdoptDrawerOpen}
            onSubmit={actions.submitAdopt}
            returnFocusRef={actions.adoptButtonRef}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
