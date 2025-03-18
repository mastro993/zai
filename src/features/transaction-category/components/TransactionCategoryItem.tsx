import { TransactionCategory, TransactionCategoryChildren } from "../schema";
import { DeleteTransactionCategoryButton } from "./DeleteTransactionCategoryButton";
import { EditTransactionCategoryButton } from "./EditTransactionCategoryButton";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
  return (
    <li
      className="list-row flex items-center justify-between bg-base-100"
      key={category.id}
    >
      <div className="flex items-center gap-2">
        <TransactionCategoryBadge name={category.name} />
        <span className="text-sm text-base-content/50 ">
          {category.description}
        </span>
      </div>
      <div className="flex gap-2">
        <EditTransactionCategoryButton category={category} />
        <DeleteTransactionCategoryButton category={category} />
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
