import { Chip } from "@heroui/react";
import type { TransactionCategory, TransactionCategoryColor } from "../types";
import { getColorHsl } from "../utils/colorUtils";

export type TransactionCategoryBadgeVariants = {
  color: Record<TransactionCategoryColor, string>;
};

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color">;
};

export const TransactionCategoryBadge = ({ category }: TransactionCategoryBadgeProps) => {
  const { name, color } = category;

  // Generate background color from hex
  const bgColor = getColorHsl(color);

  return (
    <Chip
      className="border-2"
      style={{
        backgroundColor: bgColor,
        borderColor: bgColor,
        color: "#fff",
      }}
    >
      {name}
    </Chip>
  );
};
