import type { TransactionType } from "../types/model";

export const DEFAULT_EXPENSE_TYPE_VALUES = "expense, debit, out";
export const DEFAULT_INCOME_TYPE_VALUES = "income, credit, in";

export const parseTypeValueList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

export const resolveTypeFromColumn = (
  raw: string,
  expenseValues: Array<string>,
  incomeValues: Array<string>,
): { ok: true; value: TransactionType } | { ok: false; message: string } => {
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return { ok: false, message: "Transaction type is required" };
  }

  if (expenseValues.includes(normalized)) {
    return { ok: true, value: "expense" };
  }

  if (incomeValues.includes(normalized)) {
    return { ok: true, value: "income" };
  }

  return { ok: false, message: "Unmapped transaction type value" };
};
