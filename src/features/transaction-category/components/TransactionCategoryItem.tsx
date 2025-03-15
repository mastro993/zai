import { JsonDisplay } from "@/components/ui/JsonDisplay";
import { TransactionCategory } from "../schema";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
  return (
    <li className="list-row" key={category.id}>
      <TransactionCategoryBadge name={category.name} />
      <span className="text-sm text-base-content/50">
        {category.description}
      </span>
      <JsonDisplay data={category} />
    </li>
  );
};
