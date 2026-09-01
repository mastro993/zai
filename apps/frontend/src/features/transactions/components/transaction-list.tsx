import {
  ArrowDownRight01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
} from "@/features/categories/lib/category";
import { getCategoryBadgeColors } from "@/features/categories/lib/category-color";
import {
  DEFAULT_CATEGORY_ICON,
  getCategoryIconEntry,
} from "@/features/categories/lib/category-icon";
import {
  DEFAULT_CATEGORY_COLOR,
  type TransactionCategory,
} from "@/features/categories/types/model";
import { cn } from "@/lib/utils";

import { formatTransactionRowDate, groupTransactionsByDay } from "../lib/transaction-day-groups";
import { transactionListAmountParts } from "../lib/transaction-list-amount";
import { isTransactionType } from "../lib/transaction-type-display";
import type { TransactionListItem } from "../types/model";

type TransactionListProps = {
  transactions: Array<TransactionListItem>;
  categoryById: Map<string, TransactionCategory>;
  onEdit: (transactionId: string) => void;
  onAdopt: (transaction: TransactionListItem, trigger: HTMLButtonElement | null) => void;
  onDelete: (transaction: TransactionListItem) => void;
};

const TRANSACTION_TYPE_ARROWS = {
  income: { icon: ArrowUp01Icon, className: "text-primary", label: "Income" },
  expense: { icon: ArrowDownRight01Icon, className: "text-destructive", label: "Expense" },
} as const;

const rowActionsRevealClassName =
  "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-reduce:transition-none";

function CategoryIconTile({ category }: { category: TransactionCategory | undefined }) {
  const color = category ? getCategoryDisplayColor(category) : DEFAULT_CATEGORY_COLOR;
  const { background, foreground } = getCategoryBadgeColors(color);
  const icon = getCategoryIconEntry(
    category ? getCategoryDisplayIcon(category) : DEFAULT_CATEGORY_ICON,
  );

  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: background, color: foreground }}
      aria-hidden="true"
    >
      <HugeiconsIcon icon={icon.icon} className="size-4" strokeWidth={2} />
    </span>
  );
}

function TransactionAmount({ transaction }: { transaction: TransactionListItem }) {
  const { original, display } = transactionListAmountParts(transaction);
  const type = isTransactionType(transaction.transactionType)
    ? transaction.transactionType
    : undefined;
  const arrow = type ? TRANSACTION_TYPE_ARROWS[type] : undefined;

  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="flex items-center gap-1">
        {arrow ? (
          <HugeiconsIcon
            icon={arrow.icon}
            className={cn("size-3.5", arrow.className)}
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : null}
        <span className="font-mono font-semibold tabular-nums">{display}</span>
      </span>
      {original ? (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{original}</span>
      ) : null}
    </span>
  );
}

function TransactionRowActions({
  transaction,
  onEdit,
  onAdopt,
  onDelete,
}: {
  transaction: TransactionListItem;
  onEdit: (transactionId: string) => void;
  onAdopt: (transaction: TransactionListItem, trigger: HTMLButtonElement | null) => void;
  onDelete: (transaction: TransactionListItem) => void;
}) {
  const transactionLabel = transaction.description || transaction.id;

  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-1", rowActionsRevealClassName)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Adopt ${transactionLabel} as recurring`}
        title="Make recurring"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          onAdopt(transaction, event.currentTarget);
        }}
      >
        <HugeiconsIcon icon={RepeatIcon} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${transactionLabel}`}
        title="Edit"
        onClick={() => {
          onEdit(transaction.id);
        }}
      >
        <HugeiconsIcon icon={PencilEdit02Icon} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${transactionLabel}`}
        title="Delete"
        onClick={() => {
          onDelete(transaction);
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </div>
  );
}

function TransactionListRow({
  transaction,
  category,
  onEdit,
  onAdopt,
  onDelete,
}: {
  transaction: TransactionListItem;
  category: TransactionCategory | undefined;
  onEdit: (transactionId: string) => void;
  onAdopt: (transaction: TransactionListItem, trigger: HTMLButtonElement | null) => void;
  onDelete: (transaction: TransactionListItem) => void;
}) {
  const transactionLabel = transaction.description || "No description";
  const type = isTransactionType(transaction.transactionType)
    ? transaction.transactionType
    : undefined;
  const typeLabel = type ? TRANSACTION_TYPE_ARROWS[type].label : transaction.transactionType;

  return (
    <div className="group/row flex items-center gap-1 pr-2 hover:bg-muted/50">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        aria-label={`Edit ${typeLabel}: ${transactionLabel}`}
        onClick={() => {
          onEdit(transaction.id);
        }}
      >
        <CategoryIconTile category={category} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span
            className={cn(
              "truncate text-sm font-medium",
              !transaction.description && "italic text-muted-foreground",
            )}
          >
            {transaction.description || "No description"}
          </span>
          <time
            className="truncate text-xs text-muted-foreground"
            dateTime={transaction.transactionDate}
          >
            {formatTransactionRowDate(transaction.transactionDate)}
          </time>
        </span>
        <TransactionAmount transaction={transaction} />
      </button>
      <TransactionRowActions
        transaction={transaction}
        onEdit={onEdit}
        onAdopt={onAdopt}
        onDelete={onDelete}
      />
    </div>
  );
}

function TransactionList({
  transactions,
  categoryById,
  onEdit,
  onAdopt,
  onDelete,
}: TransactionListProps) {
  const groups = groupTransactionsByDay(transactions);

  return (
    <div data-slot="transaction-list" className="flex flex-col gap-6">
      {groups.map((group) => {
        const headingId = `transaction-day-${group.dayKey}`;

        return (
          <section key={group.dayKey} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2 id={headingId} className="px-1 text-sm font-medium">
              {group.heading}
            </h2>
            <ul className="overflow-hidden rounded-lg border">
              {group.transactions.map((transaction, index) => {
                const category = transaction.transactionCategoryId
                  ? categoryById.get(transaction.transactionCategoryId)
                  : undefined;

                return (
                  <li key={transaction.id} className={index > 0 ? "border-t" : undefined}>
                    <TransactionListRow
                      transaction={transaction}
                      category={category}
                      onEdit={onEdit}
                      onAdopt={onAdopt}
                      onDelete={onDelete}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export { TransactionList };
