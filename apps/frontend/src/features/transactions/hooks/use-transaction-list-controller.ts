import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getTransactionCategories } from "@/features/categories/commands/transaction-categories";
import { getTransactions, type TransactionFilters } from "../commands/transactions";
import {
  DEFAULT_DATE_SELECTION,
  isActiveSelection,
  resolveSelection,
  type DateRangeSelection,
} from "../lib/date-range";
import { DEFAULT_TRANSACTION_ROWS_PER_PAGE } from "../lib/pagination";
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
import type { TransactionCategory } from "@/features/categories/types/model";
import type { PaginatedTransactions, TransactionListItem } from "../types/model";

export interface TransactionScreenInitialData {
  transactions: PaginatedTransactions;
  categories: Array<TransactionCategory>;
}

interface LoadTransactionsOptions {
  searchQuery: string;
  page: number;
  dateSelection: DateRangeSelection;
  typeSelection: TypeFilterSelection;
  categorySelection: CategoryFilterSelection;
  categories: Array<TransactionCategory>;
  append: boolean;
  includeCategories?: boolean;
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

const appendTransactions = (
  current: Array<TransactionListItem>,
  next: Array<TransactionListItem>,
): Array<TransactionListItem> => {
  const ids = new Set(current.map((transaction) => transaction.id));
  return [...current, ...next.filter((transaction) => !ids.has(transaction.id))];
};

export function useTransactionListController(initialData: TransactionScreenInitialData) {
  const initialTotalPages = Math.max(initialData.transactions.totalPages, 1);
  const [transactions, setTransactions] = useState(initialData.transactions.data);
  const [nextPage, setNextPage] = useState(initialData.transactions.page + 1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
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
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasSkippedInitialFetch = useRef(false);
  const listRequestIdRef = useRef(0);
  const nextPageRef = useRef(nextPage);
  const hasMoreRef = useRef(nextPage <= initialTotalPages);
  const isLoadingMoreRef = useRef(false);

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

  const resetList = useCallback(() => {
    listRequestIdRef.current += 1;
    nextPageRef.current = 1;
    hasMoreRef.current = true;
    isLoadingMoreRef.current = false;
    setTransactions([]);
    setNextPage(1);
    setTotalPages(1);
    setErrorMessage(null);
    setLoadMoreError(null);
    setIsLoadingMore(false);
  }, []);

  const loadData = useCallback(async (options: LoadTransactionsOptions) => {
    const {
      searchQuery,
      page,
      dateSelection: nextDateSelection,
      typeSelection: nextTypeSelection,
      categorySelection: nextCategorySelection,
      categories: categoriesForFilters,
      append,
      includeCategories = false,
    } = options;

    if (append) {
      if (isLoadingMoreRef.current || !hasMoreRef.current) {
        return;
      }
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setLoadMoreError(null);
    }

    const requestId = ++listRequestIdRef.current;
    const transactionsResult = await getTransactions(
      page,
      DEFAULT_TRANSACTION_ROWS_PER_PAGE,
      buildTransactionFilters(
        searchQuery,
        nextDateSelection,
        nextTypeSelection,
        nextCategorySelection,
        categoriesForFilters,
      ),
    );

    if (requestId !== listRequestIdRef.current) {
      if (append) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
      return;
    }

    const applyTransactions = (
      result: typeof transactionsResult,
      shouldAppend: boolean,
    ): boolean => {
      if (Result.isFailure(result)) {
        if (shouldAppend) {
          setLoadMoreError(result.error.message);
        } else {
          setErrorMessage(result.error.message);
        }
        return false;
      }

      const loaded = result.value;
      const loadedTotalPages = Math.max(loaded.totalPages, loaded.page);
      setTransactions((current) =>
        shouldAppend ? appendTransactions(current, loaded.data) : loaded.data,
      );
      nextPageRef.current = loaded.page + 1;
      hasMoreRef.current = loaded.page < loadedTotalPages;
      setNextPage(loaded.page + 1);
      setTotalPages(loadedTotalPages);
      if (shouldAppend) {
        setLoadMoreError(null);
      } else {
        setErrorMessage(null);
      }
      return true;
    };

    applyTransactions(transactionsResult, append);

    if (includeCategories) {
      const categoriesResult = await getTransactionCategories();

      if (requestId !== listRequestIdRef.current) {
        if (append) {
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
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
            page,
            DEFAULT_TRANSACTION_ROWS_PER_PAGE,
            buildTransactionFilters(
              searchQuery,
              nextDateSelection,
              nextTypeSelection,
              nextCategorySelection,
              loadedCategories,
            ),
          );

          if (requestId !== listRequestIdRef.current) {
            if (append) {
              isLoadingMoreRef.current = false;
              setIsLoadingMore(false);
            }
            return;
          }

          applyTransactions(refetchResult, false);
        }
      }
    }

    if (append) {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    } else if (requestId === listRequestIdRef.current) {
      setIsLoading(false);
    }
  }, []);

  const loadNextPage = useCallback(() => {
    return loadData({
      searchQuery: debouncedQuery,
      page: nextPageRef.current,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
      append: true,
    });
  }, [categories, categorySelection, dateSelection, debouncedQuery, loadData, typeSelection]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const nextQuery = query.trim();
      setDebouncedQuery(nextQuery);
      if (nextQuery !== debouncedQuery) {
        resetList();
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [debouncedQuery, query, resetList]);

  useEffect(() => {
    if (!hasSkippedInitialFetch.current) {
      hasSkippedInitialFetch.current = true;
      return;
    }

    void loadData({
      searchQuery: debouncedQuery,
      page: 1,
      dateSelection,
      typeSelection,
      categorySelection,
      categories,
      append: false,
    });
  }, [categories, categorySelection, dateSelection, debouncedQuery, loadData, typeSelection]);

  const changeDateSelection = (selection: DateRangeSelection) => {
    setDateSelection(selection);
    resetList();
  };

  const changeCategorySelection = (selection: CategoryFilterSelection) => {
    setCategorySelection(selection);
    resetList();
  };

  const changeTypeSelection = (selection: TypeFilterSelection) => {
    setTypeSelection(selection);
    resetList();
  };

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setDateSelection(DEFAULT_DATE_SELECTION);
    setTypeSelection(DEFAULT_TYPE_FILTER_SELECTION);
    setCategorySelection(DEFAULT_CATEGORY_FILTER_SELECTION);
    resetList();
  };

  const refreshList = useCallback(
    (includeCategories = false) => {
      resetList();
      return loadData({
        searchQuery: debouncedQuery,
        page: 1,
        dateSelection,
        typeSelection,
        categorySelection,
        categories,
        append: false,
        includeCategories,
      });
    },
    [
      categories,
      categorySelection,
      dateSelection,
      debouncedQuery,
      loadData,
      resetList,
      typeSelection,
    ],
  );

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
    changeTypeSelection,
    clearFilters,
    dateSelection,
    debouncedQuery,
    errorMessage,
    hasActiveFilters,
    hasMore: nextPage <= totalPages,
    isLoading,
    isLoadingMore,
    loadMoreError,
    loadNextPage,
    query,
    refreshList,
    setErrorMessage,
    setQuery,
    transactions,
    typeSelection,
  };
}
