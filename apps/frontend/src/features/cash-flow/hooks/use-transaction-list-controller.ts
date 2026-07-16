import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getTransactionCategories } from "../commands/transaction-categories";
import { getTransactions, type TransactionFilters } from "../commands/transactions";
import {
  DEFAULT_DATE_SELECTION,
  isActiveSelection,
  resolveSelection,
  type DateRangeSelection,
} from "../lib/date-range";
import { type TransactionRowsPerPage } from "../lib/pagination";
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
import type { PaginatedTransactions, TransactionCategory } from "../types/model";

export interface TransactionScreenInitialData {
  transactions: PaginatedTransactions;
  categories: Array<TransactionCategory>;
}

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

export function useTransactionListController(initialData: TransactionScreenInitialData) {
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasSkippedInitialFetch = useRef(false);
  const listRequestIdRef = useRef(0);

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

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const loadData = useCallback(
    async (
      searchQuery: string,
      pageToLoad: number,
      rowsPerPage: TransactionRowsPerPage,
      nextDateSelection: DateRangeSelection,
      nextTypeSelection: TypeFilterSelection,
      nextCategorySelection: CategoryFilterSelection,
      categoriesForFilters: Array<TransactionCategory>,
      includeCategories = false,
    ) => {
      const requestId = ++listRequestIdRef.current;
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

      if (requestId !== listRequestIdRef.current) {
        return;
      }

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

        if (requestId !== listRequestIdRef.current) {
          return;
        }

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

            if (requestId !== listRequestIdRef.current) {
              return;
            }

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

      if (requestId === listRequestIdRef.current) {
        setIsLoading(false);
      }
    },
    [],
  );

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
  }, [
    categories,
    categorySelection,
    dateSelection,
    debouncedQuery,
    loadData,
    page,
    perPage,
    typeSelection,
  ]);

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

  return {
    activeFilters,
    categories,
    categoryById,
    categorySelection,
    changeCategorySelection,
    changeDateSelection,
    changeRowsPerPage,
    changeTypeSelection,
    clearFilters,
    dateSelection,
    debouncedQuery,
    errorMessage,
    hasActiveFilters,
    isLoading,
    loadData,
    page,
    perPage,
    query,
    setErrorMessage,
    setPage,
    setQuery,
    totalPages,
    transactions,
    typeSelection,
  };
}

export type TransactionListController = ReturnType<typeof useTransactionListController>;
