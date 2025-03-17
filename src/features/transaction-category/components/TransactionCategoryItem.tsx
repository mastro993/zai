import { Pencil, Trash } from "lucide-react";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { TransactionCategory, TransactionCategoryChildren } from "../schema";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
  const { mutate: deleteTransactionCategory } = useDeleteTransactionCategory();

  return (
    <li
      className="list-row flex items-center justify-between bg-base-100"
      key={category.id}
    >
      <div>
        <TransactionCategoryBadge name={category.name} />
        <span className="text-sm text-base-content/50">
          {category.description}
        </span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-square">
          <Pencil className="size-4" />
        </button>
        <button
          className="btn btn-square"
          onClick={() => deleteTransactionCategory(category.id)}
        >
          <Trash className="size-4" />
        </button>
      </div>
    </li>
  );
};

type TransactionCategoryChildItemProps = {
  category: TransactionCategoryChildren;
};

const TransactionCategoryChildItem = ({
  category,
}: TransactionCategoryChildItemProps) => {
  return (
    <li className="list-row bg-base-100" key={category.id}>
      <TransactionCategoryBadge name={category.name} />
      <span className="text-sm text-base-content/50">
        {category.description}
      </span>
    </li>
  );
};
