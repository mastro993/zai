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
        "rounded-md bg-gray-50 ",
        "ring-1 ring-gray-500/10 ring-inset",
        "text-xs font-medium text-gray-600",
      ])}
    >
      {name}
    </span>
  );
};
