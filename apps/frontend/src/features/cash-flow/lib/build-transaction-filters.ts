import type { TransactionFilters } from "../commands/transactions";
import { isActiveSelection, resolveSelection, type DateRangeSelection } from "./date-range";
import {
  expandCategoryIdsForApi,
  isActiveCategoryFilter,
  type CategoryFilterSelection,
} from "./transaction-category-filter";
import { isActiveTypeFilter, type TypeFilterSelection } from "./transaction-type-filter";
import type { TransactionCategory } from "../types/model";

export function buildTransactionFilters(
  searchQuery: string,
  dateSelection: DateRangeSelection,
  typeSelection: TypeFilterSelection,
  categorySelection: CategoryFilterSelection,
  categories: Array<TransactionCategory>,
): TransactionFilters | undefined {
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
}

export function hasActiveTransactionFilters(
  searchQuery: string,
  dateSelection: DateRangeSelection,
  typeSelection: TypeFilterSelection,
  categorySelection: CategoryFilterSelection,
): boolean {
  return (
    searchQuery.length > 0 ||
    isActiveSelection(dateSelection) ||
    isActiveTypeFilter(typeSelection) ||
    isActiveCategoryFilter(categorySelection)
  );
}
