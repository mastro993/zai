import { changeLuminosity, shouldUseDarkForeground } from "@/utils/color";
import { Chip } from "@heroui/react";
import type { TransactionCategory } from "../types";

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color">;
};

export const TransactionCategoryBadge = ({ category }: TransactionCategoryBadgeProps) => {
  const { name, color } = category;

  if (!color) {
    return (
      <Chip size="sm" className="border-1 border-default-300 bg-default-100 text-default-700">
        {name}
      </Chip>
    );
  }

  const useDarkForeground = shouldUseDarkForeground(color);

  return (
    <Chip
      size="sm"
      className="border-1"
      style={{
        backgroundColor: color,
        borderColor: changeLuminosity(color, useDarkForeground ? -18 : 10),
        color: useDarkForeground ? "#111827" : "#FFFFFF",
      }}
    >
      {name}
    </Chip>
  );
};
