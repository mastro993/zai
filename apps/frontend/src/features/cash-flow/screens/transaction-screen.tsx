import { Result } from "@praha/byethrow";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import { exportTransactions } from "../commands/transaction-export";
import { getTransactionCategories } from "../commands/transaction-categories";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  getAllTransactions,
  getTransactions,
  type TransactionFilters,
  updateTransaction,
} from "../commands/transactions";
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
import { type TransactionRowsPerPage } from "../lib/pagination";
import {
  DEFAULT_DATE_SELECTION,
  isActiveSelection,
  resolveSelection,
  type DateRangeSelection,
} from "../lib/date-range";
import {
  DEFAULT_CATEGORY_FILTER_SELECTION,
  expandCategoryIdsForApi,
  isActiveCategoryFilter,
  type CategoryFilterSelection,
} from "../lib/transaction-category-filter";
import {
  DEFAULT_TYPE_FILTER_SELECTION,
  isActiveTypeFilter,
  type TypeFilterSelection,
} from "../lib/transaction-type-filter";
import type {
  PaginatedTransactions,
  Transaction,
  TransactionCategory,
  TransactionFormValues,
} from "../types/model";
import { useTransactionSelection } from "../hooks/use-transaction-selection";
import type { TransactionFormMode } from "../types/transaction-types";

type TransactionScreenInitialData = {
  transactions: PaginatedTransactions;
  categories: Array<TransactionCategory>;
};

type TransactionScreenProps = {
  initialData: TransactionScreenInitialData;
};

const buildTransactionFilters = (
  searchQuery: string,
  dateSelection: DateRangeSelection,
  typeSelection: TypeFilterSelection,
  categorySelection: CategoryFilterSelection,
  categories: Array<TransactionCategory>,
): TransactionFilters | undefined => {
  const range = resolveSelection(dateSelection);
  const filters: TransactionFilters = {};

  if (searchQuery.length > 0) {
    filters.query = searchQuery;
  }
  if (range.startDate) {
    filters.startDate = range.startDate;
  }
  if (range.endDate) {
    filters.endDate = range.endDate;
  }
  if (typeSelection) {
    filters.transactionType = typeSelection;
  }

  if (categorySelection.includeUncategorized) {
    filters.categories = [];
  } else {
    const expandedCategories = expandCategoryIdsForApi(categorySelection.categoryIds, categories);
    if (expandedCategories.length > 0) {
      filters.categories = expandedCategories;
    }
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
};

export function TransactionScreen({ initialData }: TransactionScreenProps) {
  const [transactions, setTransactions] = useState(initialData.transactions.data);
  const [page, setPage] = useState(initialData.transactions.page);
  const [perPage, setPerPage] = useState<TransactionRowsPerPage>(
    initialData.transactions.perPage as TransactionRowsPerPage,
  );
  const [totalPages, setTotalPages] = useState(Math.max(initialData.transactions.totalPages, 1));
  const [categories, setCategories] = useState(initialData.categories);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dateSelection, setDateSelection] = useState<DateRangeSelection>(DEFAULT_DATE_SELECTION);
  const [categorySelection, setCategorySelection] = useState<CategoryFilterSelection>(
    DEFAULT_CATEGORY_FILTER_SELECTION,
  );
  const [typeSelection, setTypeSelection] = useState<TypeFilterSelection>(
    DEFAULT_TYPE_FILTER_SELECTION,
  );
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState(false);
  const hasSkippedInitialFetch = useRef(false);

  const activeFilters = useMemo(
    () =>
      buildTransactionFilters(
        debouncedQuery,
        dateSelection,
        typeSelection,
        categorySelection,
        categories,
      ),
    [debouncedQuery, dateSelection, typeSelection, categorySelection, categories],
  );

  const {
    selectedIds,
    selectedCount,
    selectAllMatching,
    pageCheckboxState,
    clearSelection,
    syncFilterFingerprint,
    toggleRow,
    togglePage,
    applySelectAllMatching,
    removeFromSelection,
  } = useTransactionSelection(transactions);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const loadData = async (
    searchQuery: string,
    pageToLoad: number,
    rowsPerPage: TransactionRowsPerPage,
    nextDateSelection: DateRangeSelection,
    nextTypeSelection: TypeFilterSelection,
    nextCategorySelection: CategoryFilterSelection,
    categoriesForFilters: Array<TransactionCategory>,
    includeCategories = false,
  ) => {
    setIsLoading(true);
    const transactionsResult = await getTransactions(
      pageToLoad,
      rowsPerPage,
      buildTransactionFilters(
        searchQuery,
        nextDateSelection,
        nextTypeSelection,
        nextCategorySelection,
        categoriesForFilters,
      ),
    );

    if (Result.isFailure(transactionsResult)) {
      setErrorMessage(transactionsResult.error.message);
    } else {
      const { data, page: loadedPage, totalPages: loadedTotalPages } = transactionsResult.value;

      if (data.length === 0 && loadedPage > 1) {
        setPage(loadedPage - 1);
        setIsLoading(false);
        return;
      }

      setTransactions(data);
      setPage(loadedPage);
      setTotalPages(Math.max(loadedTotalPages, 1));
      setErrorMessage(null);
    }

    if (includeCategories) {
      const categoriesResult = await getTransactionCategories();
      if (Result.isFailure(categoriesResult)) {
        setErrorMessage(categoriesResult.error.message);
      } else {
        const loadedCategories = categoriesResult.value;
        setCategories(loadedCategories);
        if (Result.isSuccess(transactionsResult)) {
          setErrorMessage(null);
        }

        if (isActiveCategoryFilter(nextCategorySelection)) {
          const refetchResult = await getTransactions(
            pageToLoad,
            rowsPerPage,
            buildTransactionFilters(
              searchQuery,
              nextDateSelection,
              nextTypeSelection,
              nextCategorySelection,
              loadedCategories,
            ),
          );

          if (Result.isFailure(refetchResult)) {
            setErrorMessage(refetchResult.error.message);
          } else {
            const { data, page: loadedPage, totalPages: loadedTotalPages } = refetchResult.value;

            if (data.length === 0 && loadedPage > 1) {
              setPage(loadedPage - 1);
              setIsLoading(false);
              return;
            }

            setTransactions(data);
            setPage(loadedPage);
            setTotalPages(Math.max(loadedTotalPages, 1));
            setErrorMessage(null);
          }
        }
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    syncFilterFingerprint(activeFilters);
  }, [activeFilters, syncFilterFingerprint]);

  useEffect(() => {
    if (!hasSkippedInitialFetch.current) {
      hasSkippedInitialFetch.current = true;
      return;
    }

    void loadData(
      debouncedQuery,
      page,
      perPage,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
    );
  }, [debouncedQuery, page, perPage, dateSelection, typeSelection, categorySelection, categories]);

  const openFormDrawer = (mode: TransactionFormMode) => {
    setFormMode(mode);
    setIsFormDrawerOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    setPendingDelete(transaction);
    setIsDeleteDialogOpen(true);
  };

  const submitTransaction = async (values: TransactionFormValues) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransaction(formMode.transaction.id, values)
        : await createTransaction(values);

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      return;
    }

    setIsFormDrawerOpen(false);
    await loadData(
      debouncedQuery,
      page,
      perPage,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
    );
  };

  const exportTransactionCsv = async () => {
    setIsExporting(true);
    const isSelectedExport = selectedCount > 0;

    let transactionsToExport: Array<Transaction>;

    if (isSelectedExport) {
      const allTransactionsResult = await getAllTransactions();

      if (Result.isFailure(allTransactionsResult)) {
        toast.error("Failed to export selected transactions", {
          description: allTransactionsResult.error.message,
        });
        setIsExporting(false);
        return;
      }

      transactionsToExport = allTransactionsResult.value.filter((transaction) =>
        selectedIds.has(transaction.id),
      );
    } else {
      const filteredTransactionsResult = await getAllTransactions(activeFilters);

      if (Result.isFailure(filteredTransactionsResult)) {
        toast.error("Failed to export transactions", {
          description: filteredTransactionsResult.error.message,
        });
        setIsExporting(false);
        return;
      }

      transactionsToExport = filteredTransactionsResult.value;
    }

    const result = await exportTransactions(transactionsToExport, categories);

    if (Result.isFailure(result)) {
      toast.error(
        isSelectedExport
          ? "Failed to export selected transactions"
          : "Failed to export transactions",
        { description: result.error.message },
      );
    } else if (result.value) {
      toast.success(isSelectedExport ? "Selected transactions exported" : "Transactions exported", {
        description: result.value,
      });
    } else {
      toast.info(
        isSelectedExport ? "Selected transaction export canceled" : "Transaction export canceled",
      );
    }

    setIsExporting(false);
  };

  const removeTransaction = async (transaction: Transaction) => {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    removeFromSelection(transaction.id);
    setIsDeleteDialogOpen(false);
    await loadData(
      debouncedQuery,
      page,
      perPage,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
    );
    setIsDeleting(false);
  };

  const selectAllMatchingTransactions = async () => {
    setIsSelectingAllMatching(true);

    const transactionsResult = await getAllTransactions(activeFilters);

    if (Result.isFailure(transactionsResult)) {
      toast.error("Failed to select matching transactions", {
        description: transactionsResult.error.message,
      });
      setIsSelectingAllMatching(false);
      return;
    }

    applySelectAllMatching(transactionsResult.value, activeFilters);
    setIsSelectingAllMatching(false);
  };

  const removeSelectedTransactions = async () => {
    const transactionIds = [...selectedIds];

    if (transactionIds.length === 0) {
      return;
    }

    setIsBulkDeleting(true);
    const result = await deleteTransactions(transactionIds);

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsBulkDeleteDialogOpen(false);
      setIsBulkDeleting(false);
      return;
    }

    const deletedCount = result.value.length;

    clearSelection();
    setIsBulkDeleteDialogOpen(false);
    await loadData(
      debouncedQuery,
      page,
      perPage,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
    );
    setIsBulkDeleting(false);
    toast.success(
      deletedCount === 1 ? "Deleted 1 transaction" : `Deleted ${deletedCount} transactions`,
    );
  };

  const changeRowsPerPage = (nextPerPage: TransactionRowsPerPage) => {
    setPerPage(nextPerPage);
    setPage(1);
  };

  const changeDateSelection = (selection: DateRangeSelection) => {
    setDateSelection(selection);
    setPage(1);
  };

  const changeCategorySelection = (selection: CategoryFilterSelection) => {
    setCategorySelection(selection);
    setPage(1);
  };

  const changeTypeSelection = (selection: TypeFilterSelection) => {
    setTypeSelection(selection);
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setDateSelection(DEFAULT_DATE_SELECTION);
    setTypeSelection(DEFAULT_TYPE_FILTER_SELECTION);
    setCategorySelection(DEFAULT_CATEGORY_FILTER_SELECTION);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedQuery.length > 0 ||
    isActiveSelection(dateSelection) ||
    isActiveTypeFilter(typeSelection) ||
    isActiveCategoryFilter(categorySelection);

  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Log income and expenses with an optional category.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            type="search"
            placeholder="Search description or notes..."
            value={query}
            className="w-72"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <TransactionDateFilter
            selection={dateSelection}
            onSelectionChange={changeDateSelection}
          />
          <TransactionTypeFilter
            selection={typeSelection}
            onSelectionChange={changeTypeSelection}
          />
          <TransactionCategoryFilter
            categories={categories}
            selection={categorySelection}
            isLoading={isLoading && categories.length === 0}
            onSelectionChange={changeCategorySelection}
          />
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            Import transactions
          </Button>
          <Button
            variant="outline"
            disabled={isLoading || isExporting}
            onClick={exportTransactionCsv}
          >
            {isExporting
              ? selectedCount > 0
                ? "Exporting selected..."
                : "Exporting..."
              : selectedCount > 0
                ? "Export selected transactions"
                : "Export transactions"}
          </Button>
          <Button onClick={() => openFormDrawer({ type: "create" })}>New transaction</Button>
        </div>
      </div>

      <TransactionSelectionBar
        selectedCount={selectedCount}
        isDeleting={isBulkDeleting}
        onDelete={() => setIsBulkDeleteDialogOpen(true)}
        onClearSelection={clearSelection}
      />

      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {isSelectingAllMatching ? (
        <p className="text-sm text-muted-foreground">Selecting matching transactions...</p>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading transactions...</p> : null}

      {!isLoading && transactions.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex flex-col items-start gap-3 border border-dashed p-6">
            <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <p className="border border-dashed p-6 text-sm text-muted-foreground">
            No transactions yet. Add income or an expense to start tracking cash flow.
          </p>
        )
      ) : null}

      {transactions.length > 0 ? (
        <div className="flex flex-col gap-0">
          <TransactionTable
            transactions={transactions}
            categoryById={categoryById}
            selectedIds={selectedIds}
            pageCheckboxState={pageCheckboxState}
            selectAllMatching={selectAllMatching}
            page={page}
            perPage={perPage}
            totalPages={totalPages}
            onToggleRow={toggleRow}
            onTogglePage={(selectAll) => {
              togglePage(transactions, selectAll);
            }}
            onSelectAllMatching={selectAllMatchingTransactions}
            onEdit={openFormDrawer}
            onDelete={openDeleteDialog}
          />
          <TransactionPagination
            page={page}
            perPage={perPage}
            totalPages={totalPages}
            visibleCount={transactions.length}
            onPageChange={setPage}
            onPerPageChange={changeRowsPerPage}
          />
        </div>
      ) : null}

      <TransactionDeleteConfirmationDialog
        transaction={pendingDelete}
        open={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onOpenChange={setIsDeleteDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onDelete={() => {
          if (pendingDelete) {
            void removeTransaction(pendingDelete);
          }
        }}
      />

      <TransactionBulkDeleteDialog
        selectedCount={selectedCount}
        open={isBulkDeleteDialogOpen}
        isDeleting={isBulkDeleting}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onOpenChangeComplete={() => undefined}
        onDelete={() => {
          void removeSelectedTransactions();
        }}
      />

      <TransactionImportDialog
        open={isImportDialogOpen}
        categories={categories}
        onOpenChange={setIsImportDialogOpen}
        onImported={async (createdCount, skippedRows) => {
          await loadData(
            debouncedQuery,
            page,
            perPage,
            dateSelection,
            typeSelection,
            categorySelection,
            categories,
            true,
          );
          toast.success(`Imported ${createdCount} transactions`, {
            description:
              skippedRows > 0 ? `${skippedRows} rows were skipped during preview.` : undefined,
          });
        }}
      />

      <Drawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setFormMode(null);
          }
        }}
        swipeDirection="right"
      >
        {formMode ? (
          <TransactionFormDrawer
            key={formMode.type === "edit" ? formMode.transaction.id : "create"}
            mode={formMode}
            categories={categories}
            onSubmit={submitTransaction}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
