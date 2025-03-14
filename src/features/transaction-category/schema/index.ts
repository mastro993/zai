import {
  Generated,
  GeneratedAlways,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

export type TransactionCategoryTable = {
  id: Generated<number>;
  parent_id?: number;
  name: string;
  color: string;
  icon: string;
  description: string;
  created_at: GeneratedAlways<string>;
  updated_at: GeneratedAlways<string>;
  deleted_at?: string;
};

export type TransactionCategory = Selectable<TransactionCategoryTable> & {
  parent: Selectable<TransactionCategoryTable> | null;
  children: Selectable<TransactionCategoryTable>[];
};

export type NewTransactionCategory = Insertable<TransactionCategoryTable>;
export type TransactionCategoryUpdate = Updateable<TransactionCategoryTable>;
