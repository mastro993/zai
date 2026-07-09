import { formatTransactionTypeLabel } from "./transaction-type-display";
import type { TransactionType } from "../types/model";

export type TypeFilterSelection = TransactionType | null;

export const DEFAULT_TYPE_FILTER_SELECTION: TypeFilterSelection = null;

export const TYPE_FILTER_OPTIONS: ReadonlyArray<{
  value: TypeFilterSelection;
  label: string;
}> = [
  { value: null, label: "All types" },
  { value: "income", label: formatTransactionTypeLabel("income") },
  { value: "expense", label: formatTransactionTypeLabel("expense") },
];

export const isActiveTypeFilter = (selection: TypeFilterSelection): boolean => selection !== null;

export const formatTypeFilterLabel = (selection: TypeFilterSelection): string => {
  if (!selection) {
    return "Type";
  }

  return TYPE_FILTER_OPTIONS.find((option) => option.value === selection)?.label ?? "Type";
};
