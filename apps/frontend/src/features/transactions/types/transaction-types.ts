import type { Transaction } from "./model";

type TransactionFormMode = { type: "create" } | { type: "edit"; transaction: Transaction };

export type { TransactionFormMode };
