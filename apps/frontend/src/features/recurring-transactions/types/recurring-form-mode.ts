import type { RecurringTransactionDocument } from "../types/recurring-transaction";

export type RecurringFormMode =
  | { type: "create" }
  | { type: "edit"; document: RecurringTransactionDocument };
