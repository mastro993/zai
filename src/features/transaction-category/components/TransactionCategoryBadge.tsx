import { TransactionCategory } from "@/features/transaction-category/schema";
import { cn } from "@/utils/style";

export type TransactionCategoryBadgeProps = Pick<TransactionCategory, "name">;

export const TransactionCategoryBadge = ({
  name,
}: TransactionCategoryBadgeProps) => {
  return (
    <span
      className={cn([
        "inline-flex items-center",
        "px-2 py-1",
        "rounded-md bg-base-300",
        "ring-1 ring-base-300/10 ring-inset",
        "text-xs font-medium text-base-content",
      ])}
    >
      {name}
    </span>
  );
};
