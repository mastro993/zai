import type { Transaction } from "@/features/transactions/types/model";

import type { RecurringTransactionDocument } from "../types/recurring-transaction";

export type RecurringFormMode =
  | { type: "create" }
  | { type: "edit"; document: RecurringTransactionDocument }
  | { type: "adopt"; transaction: Transaction };
