import {
  Generated,
  GeneratedAlways,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

export type TransactionTable = {
  id: Generated<number>;
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

export type Transaction = Selectable<TransactionTable>;
type NewTransaction = Insertable<TransactionTable>;
type TransactionUpdate = Updateable<TransactionTable>;
