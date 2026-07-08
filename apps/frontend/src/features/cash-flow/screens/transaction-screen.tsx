import { R } from "@praha/byethrow";
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
  getAllTransactions,
  getTransactions,
  type TransactionFilters,
  updateTransaction,
} from "../commands/transactions";
import { TransactionCategoryFilter } from "../components/transaction-category-filter";
import { TransactionDateFilter } from "../components/transaction-date-filter";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionImportDialog } from "../components/transaction-import-dialog";
import { TransactionPagination } from "../components/transaction-pagination";
import { TransactionTable } from "../components/transaction-table";
import { DEFAULT_TRANSACTION_ROWS_PER_PAGE, type TransactionRowsPerPage } from "../lib/pagination";
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
import type { Transaction, TransactionCategory, TransactionFormValues } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

const buildTransactionFilters = (
  searchQuery: string,
  dateSelection: DateRangeSelection,
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

export function TransactionScreen() {
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<TransactionRowsPerPage>(DEFAULT_TRANSACTION_ROWS_PER_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<Array<TransactionCategory>>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dateSelection, setDateSelection] = useState<DateRangeSelection>(DEFAULT_DATE_SELECTION);
  const [categorySelection, setCategorySelection] = useState<CategoryFilterSelection>(
    DEFAULT_CATEGORY_FILTER_SELECTION,
  );
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasLoadedCategories = useRef(false);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const loadData = async (
    searchQuery: string,
    pageToLoad: number,
    rowsPerPage: TransactionRowsPerPage,
    nextDateSelection: DateRangeSelection,
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
        nextCategorySelection,
        categoriesForFilters,
      ),
    );

    if (R.isFailure(transactionsResult)) {
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
      if (R.isFailure(categoriesResult)) {
        setErrorMessage(categoriesResult.error.message);
      } else {
        const loadedCategories = categoriesResult.value;
        setCategories(loadedCategories);
        if (R.isSuccess(transactionsResult)) {
          setErrorMessage(null);
        }

        if (isActiveCategoryFilter(nextCategorySelection)) {
          const refetchResult = await getTransactions(
            pageToLoad,
            rowsPerPage,
            buildTransactionFilters(
              searchQuery,
              nextDateSelection,
              nextCategorySelection,
              loadedCategories,
            ),
          );

          if (R.isFailure(refetchResult)) {
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
    const includeCategories = !hasLoadedCategories.current;
    hasLoadedCategories.current = true;
    void loadData(
      debouncedQuery,
      page,
      perPage,
      dateSelection,
      categorySelection,
      categories,
      includeCategories,
    );
  }, [debouncedQuery, page, perPage, dateSelection, categorySelection, categories]);

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

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      return;
    }

    setIsFormDrawerOpen(false);
    await loadData(debouncedQuery, page, perPage, dateSelection, categorySelection, categories);
  };

  const exportTransactionCsv = async () => {
    setIsExporting(true);

    const transactionsResult = await getAllTransactions(
      buildTransactionFilters(debouncedQuery, dateSelection, categorySelection, categories),
    );

    if (R.isFailure(transactionsResult)) {
      toast.error("Failed to export transactions", {
        description: transactionsResult.error.message,
      });
      setIsExporting(false);
      return;
    }

    const result = await exportTransactions(transactionsResult.value, categories);

    if (R.isFailure(result)) {
      toast.error("Failed to export transactions", { description: result.error.message });
    } else if (result.value) {
      toast.success("Transactions exported", { description: result.value });
    } else {
      toast.info("Transaction export canceled");
    }

    setIsExporting(false);
  };

  const removeTransaction = async (transaction: Transaction) => {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    setIsDeleteDialogOpen(false);
    await loadData(debouncedQuery, page, perPage, dateSelection, categorySelection, categories);
    setIsDeleting(false);
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

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setDateSelection(DEFAULT_DATE_SELECTION);
    setCategorySelection(DEFAULT_CATEGORY_FILTER_SELECTION);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedQuery.length > 0 ||
    isActiveSelection(dateSelection) ||
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
            {isExporting ? "Exporting..." : "Export transactions"}
          </Button>
          <Button onClick={() => openFormDrawer({ type: "create" })}>New transaction</Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
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
