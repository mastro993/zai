import { Badge } from "@radix-ui/themes";
import { TransactionCategory } from "../schema";

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color" | "parent">;
  size?: "1" | "2" | "3";
};

export const TransactionCategoryBadge = ({
  category,
  size = "2",
}: TransactionCategoryBadgeProps) => {
  const { name, color } = category;
  return (
    <Badge color={color} size={size}>
      {name}
    </Badge>
  );
};
