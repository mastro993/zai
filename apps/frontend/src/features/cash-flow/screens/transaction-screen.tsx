import { useEffect } from "react";

import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import { TransactionBulkDeleteDialog } from "../components/transaction-bulk-delete-dialog";
import { TransactionCategoryFilter } from "../components/transaction-category-filter";
import { TransactionDateFilter } from "../components/transaction-date-filter";
import { TransactionTypeFilter } from "../components/transaction-type-filter";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionSelectionBar } from "../components/transaction-selection-bar";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionImportDialog } from "../components/transaction-import-dialog";
import { TransactionPagination } from "../components/transaction-pagination";
import { TransactionTable } from "../components/transaction-table";
import { useTransactionActions } from "../hooks/use-transaction-actions";
import { useTransactionList } from "../hooks/use-transaction-list";
import { useTransactionSelection } from "../hooks/use-transaction-selection";
import type { PaginatedTransactions, TransactionCategory } from "../types/model";

interface TransactionScreenInitialData {
  transactions: PaginatedTransactions;
  categories: Array<TransactionCategory>;
}

interface TransactionScreenProps {
  initialData: TransactionScreenInitialData;
}

export function TransactionScreen({ initialData }: TransactionScreenProps) {
  const list = useTransactionList({ initialData });
  const selection = useTransactionSelection(list.transactions);
  const { syncFilterFingerprint } = selection;
  const actions = useTransactionActions({
    activeFilters: list.activeFilters,
    selectedIds: selection.selectedIds,
    selectedCount: selection.selectedCount,
    clearSelection: selection.clearSelection,
    applySelectAllMatching: selection.applySelectAllMatching,
    removeFromSelection: selection.removeFromSelection,
    reload: list.reload,
    setErrorMessage: list.setErrorMessage,
  });

  useEffect(() => {
    syncFilterFingerprint(list.activeFilters);
  }, [list.activeFilters, syncFilterFingerprint]);

  return (
    <ScreenBase
      actions={
        <>
          <Button variant="outline" onClick={() => actions.setIsImportDialogOpen(true)}>
            Import transactions
          </Button>
          <Button
            variant="outline"
            disabled={
              list.isLoading ||
              actions.isExporting ||
              (selection.selectedCount === 0 && list.transactions.length === 0)
            }
            onClick={actions.exportTransactionCsv}
          >
            {actions.isExporting
              ? selection.selectedCount > 0
                ? "Exporting selected..."
                : "Exporting..."
              : selection.selectedCount > 0
                ? "Export selected transactions"
                : "Export transactions"}
          </Button>
          <Button onClick={() => actions.openFormDrawer({ type: "create" })}>
            New transaction
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TransactionSelectionBar
          selectedCount={selection.selectedCount}
          isDeleting={actions.isBulkDeleting}
          onDelete={() => actions.setIsBulkDeleteDialogOpen(true)}
          onClearSelection={selection.clearSelection}
        />
        <Input
          type="search"
          placeholder="Search description or notes..."
          value={list.query}
          className="w-72"
          onChange={(event) => {
            list.setQuery(event.target.value);
          }}
        />
        <TransactionDateFilter
          selection={list.dateSelection}
          onSelectionChange={list.changeDateSelection}
        />
        <TransactionTypeFilter
          selection={list.typeSelection}
          onSelectionChange={list.changeTypeSelection}
        />
        <TransactionCategoryFilter
          categories={list.categories}
          selection={list.categorySelection}
          isLoading={list.isLoading && list.categories.length === 0}
          onSelectionChange={list.changeCategorySelection}
        />
      </div>

      {list.errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {list.errorMessage}
        </div>
      ) : null}

      {actions.isSelectingAllMatching ? (
        <p className="text-sm text-muted-foreground">Selecting matching transactions...</p>
      ) : null}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading transactions...</p>
      ) : null}

      {!list.isLoading && list.transactions.length === 0 ? (
        list.hasActiveFilters ? (
          <div className="flex flex-col items-start gap-3 border border-dashed p-6">
            <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
            <Button variant="outline" size="sm" onClick={list.clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <p className="border border-dashed p-6 text-sm text-muted-foreground">
            No transactions yet. Add income or an expense to start tracking cash flow.
          </p>
        )
      ) : null}

      {list.transactions.length > 0 ? (
        <div className="flex flex-col gap-0">
          <TransactionTable
            transactions={list.transactions}
            categoryById={list.categoryById}
            selectedIds={selection.selectedIds}
            pageCheckboxState={selection.pageCheckboxState}
            selectAllMatching={selection.selectAllMatching}
            page={list.page}
            perPage={list.perPage}
            totalPages={list.totalPages}
            onToggleRow={selection.toggleRow}
            onTogglePage={(selectAll) => {
              selection.togglePage(list.transactions, selectAll);
            }}
            onSelectAllMatching={actions.selectAllMatchingTransactions}
            onEdit={actions.openFormDrawer}
            onDelete={actions.openDeleteDialog}
          />
          <TransactionPagination
            page={list.page}
            perPage={list.perPage}
            totalPages={list.totalPages}
            visibleCount={list.transactions.length}
            onPageChange={list.setPage}
            onPerPageChange={list.changeRowsPerPage}
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

      <TransactionBulkDeleteDialog
        selectedCount={selection.selectedCount}
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
        categories={list.categories}
        onOpenChange={actions.setIsImportDialogOpen}
        onImported={actions.handleImported}
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
            categories={list.categories}
            onSubmit={actions.submitTransaction}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
