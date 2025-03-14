import { TransactionCategoryTable } from "@/features/transaction-category/schema";
import { GeneratedAlways, Insertable, Selectable, Updateable } from "kysely";

export type TransactionTable = {
  id: GeneratedAlways<number>;
  description: string;
  amount: number;
  date: string;
  type: string;
  category_id?: number;
  notes: string;
  created_at: GeneratedAlways<string>;
  updated_at: GeneratedAlways<string>;
  deleted_at?: string;
};

export type Transaction = Selectable<TransactionTable> & {
  category: Selectable<TransactionCategoryTable> | null;
};

export type NewTransaction = Insertable<TransactionTable>;
export type TransactionUpdate = Updateable<TransactionTable>;
