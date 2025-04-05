import { GeneratedAlways, Insertable, Selectable, Updateable } from "kysely";

export const TransactionCategoryColors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "neutral",
] as const;

export type TransactionCategoryColor =
  (typeof TransactionCategoryColors)[number];

export type TransactionCategoryTable = {
  id: GeneratedAlways<number>;
  parent_id: number | null;
  name: string;
  color: TransactionCategoryColor | null;
  icon: string | null;
  description: string | null;
  created_at: GeneratedAlways<string>;
  updated_at: GeneratedAlways<string>;
  deleted_at: string | null;
};

export type TransactionCategoryChildren = Selectable<TransactionCategoryTable>;

export type TransactionCategory = Selectable<TransactionCategoryTable> & {
  parent: Selectable<TransactionCategoryTable> | null;
  children: TransactionCategoryChildren[];
};

export type NewTransactionCategory = Insertable<TransactionCategoryTable>;
export type TransactionCategoryUpdate = Updateable<TransactionCategoryTable>;
