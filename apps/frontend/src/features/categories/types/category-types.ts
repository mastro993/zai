import type { TransactionCategory } from "./model";

type CategoryFormMode =
  | { type: "create-root" }
  | { type: "create-child"; parentId: string }
  | { type: "edit"; category: TransactionCategory };

export type { CategoryFormMode };
