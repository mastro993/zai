import { toast } from "sonner";

import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import { TransactionBulkDeleteDialog } from "../components/transaction-bulk-delete-dialog";
import { TransactionCategoryFilter } from "../components/transaction-category-filter";
import { TransactionDateFilter } from "../components/transaction-date-filter";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionImportDialog } from "../components/transaction-import-dialog";
import { TransactionPagination } from "../components/transaction-pagination";
import { TransactionSelectionBar } from "../components/transaction-selection-bar";
import { TransactionTable } from "../components/transaction-table";
import { TransactionTypeFilter } from "../components/transaction-type-filter";
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
              controller.isLoading ||
              actions.isExporting ||
              (actions.selectedCount === 0 && controller.transactions.length === 0)
            }
            onClick={actions.exportTransactionCsv}
          >
            {actions.isExporting
              ? actions.selectedCount > 0
                ? "Exporting selected..."
                : "Exporting..."
              : actions.selectedCount > 0
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
          <div className="flex flex-col items-start gap-3 border border-dashed p-6">
            <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
            <Button variant="outline" size="sm" onClick={controller.clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <p className="border border-dashed p-6 text-sm text-muted-foreground">
            No transactions yet. Add income or an expense to start tracking cash flow.
          </p>
        )
      ) : null}

      {controller.transactions.length > 0 ? (
        <div className="flex flex-col gap-0">
          <TransactionTable
            transactions={controller.transactions}
            categoryById={controller.categoryById}
            selectedIds={actions.selectedIds}
            pageCheckboxState={actions.pageCheckboxState}
            selectAllMatching={actions.selectAllMatching}
            page={controller.page}
            perPage={controller.perPage}
            totalPages={controller.totalPages}
            onToggleRow={actions.toggleRow}
            onTogglePage={(selectAll) => {
              actions.togglePage(controller.transactions, selectAll);
            }}
            onSelectAllMatching={actions.selectAllMatchingTransactions}
            onEdit={actions.openFormDrawer}
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
            onSubmit={actions.submitTransaction}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
