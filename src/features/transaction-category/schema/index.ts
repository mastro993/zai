import {
  Generated,
  GeneratedAlways,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

export const TransactionCategoryColors = [
  // Hard colors
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
  "neutral",
  // Soft colors
  "red-soft",
  "orange-soft",
  "yellow-soft",
  "green-soft",
  "teal-soft",
  "sky-soft",
  "blue-soft",
  "indigo-soft",
  "purple-soft",
  "pink-soft",
  "neutral-soft",
] as const;

export type TransactionCategoryColor =
  (typeof TransactionCategoryColors)[number];

export type TransactionCategoryTable = {
  id: GeneratedAlways<number>;
  parent_id: number | null;
  name: string;
  color: TransactionCategoryColor | null;
  description: string | null;
  created_at: GeneratedAlways<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
};

export type TransactionCategoryChildren = Selectable<TransactionCategoryTable>;

export type TransactionCategory = Selectable<TransactionCategoryTable> & {
  parent: Selectable<TransactionCategoryTable> | null;
  children: TransactionCategoryChildren[];
};

export type NewTransactionCategory = Insertable<TransactionCategoryTable>;
export type TransactionCategoryUpdate = Updateable<TransactionCategoryTable>;
