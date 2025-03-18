import { cn } from "@/utils/style";
import { TransactionCategory, TransactionCategoryColor } from "../schema";

const classByVariants: { [color in TransactionCategoryColor]: string } = {
  white: "bg-white text-base-content dark:bg-white/10 dark:text-base-content",
  red: "bg-red-500 text-base-content dark:bg-red-400/10 dark:text-red-500 dark:ring-red-300/10",
  yellow:
    "bg-yellow-500 text-base-content dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-300/10",
  green:
    "bg-green-500 text-base-content dark:bg-green-400/10 dark:text-green-500 dark:ring-green-300/10",
  blue: "bg-blue-500 text-base-content dark:bg-blue-400/10 dark:text-blue-500 dark:ring-blue-300/10",
  purple:
    "bg-purple-500 text-base-content dark:bg-purple-400/10 dark:text-purple-500 dark:ring-purple-300/10",
  pink: "bg-pink-500 text-base-content dark:bg-pink-400/10 dark:text-pink-500 dark:ring-pink-300/10",
} as const;

export type TransactionCategoryBadgeProps = Pick<
  TransactionCategory,
  "name" | "color"
>;

export const TransactionCategoryBadge = ({
  name,
  color = "white",
}: TransactionCategoryBadgeProps) => {
  return (
    <span
      className={cn([
        "inline-flex items-center",
        "px-2 py-1",
        `rounded-md ring-1 ring-base-content/20`,
        `text-xs font-medium `,
        classByVariants[color],
      ])}
    >
      {name}
    </span>
  );
};
