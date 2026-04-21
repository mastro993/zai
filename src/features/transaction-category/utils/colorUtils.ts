import { transactionCategoryColors } from "@/config/transaction-categories";
import { normalizeHexColor } from "@/utils/color";
import type { TransactionCategoryColor } from "../types";

export type TransactionCategoryPaletteId = keyof typeof transactionCategoryColors;

export type TransactionCategoryPaletteOption = {
  id: TransactionCategoryPaletteId;
  label: string;
  color: TransactionCategoryColor;
};

export const transactionCategoryPaletteOptions: TransactionCategoryPaletteOption[] = Object.entries(
  transactionCategoryColors,
).map(([id, color]) => ({
  id: id as TransactionCategoryPaletteId,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  color,
}));

export function getTransactionCategoryPaletteColor(
  color?: string | null,
): TransactionCategoryColor | undefined {
  if (!color) {
    return undefined;
  }

  const normalizedColor = normalizeHexColor(color);

  return transactionCategoryPaletteOptions.find(
    (option) => normalizeHexColor(option.color) === normalizedColor,
  )?.color;
}

export function getTransactionCategoryPaletteId(
  color?: string | null,
): TransactionCategoryPaletteId | undefined {
  if (!color) {
    return undefined;
  }

  const normalizedColor = normalizeHexColor(color);

  return transactionCategoryPaletteOptions.find(
    (option) => normalizeHexColor(option.color) === normalizedColor,
  )?.id;
}
