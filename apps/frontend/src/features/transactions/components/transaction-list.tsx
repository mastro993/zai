import {
  ArrowDownRight01Icon,
  ArrowUpRight03Icon,
  Delete02Icon,
  PencilEdit02Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

import {
  formatTransactionDayTotal,
  formatTransactionRowDate,
  groupTransactionsByDay,
} from "../lib/transaction-day-groups";
import { transactionListAmountParts } from "../lib/transaction-list-amount";
import { isTransactionType } from "../lib/transaction-type-display";
import type { TransactionListItem } from "../types/model";

type TransactionListProps = {
  transactions: Array<TransactionListItem>;
  categoryById: Map<string, TransactionCategory>;
  onEdit: (transactionId: string) => void;
  onAdopt: (transaction: TransactionListItem) => void;
  onOpenRecurring: (recurringTransactionId: string) => void;
  onDelete: (transaction: TransactionListItem) => void;
};

const TRANSACTION_TYPE_ARROWS = {
  income: { icon: ArrowUpRight03Icon, className: "text-primary", label: "Income" },
  expense: { icon: ArrowDownRight01Icon, className: "text-destructive", label: "Expense" },
} as const;

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
    >
      <HugeiconsIcon icon={icon.icon} className="size-4" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

function recurringHoverLabel(recurring: NonNullable<TransactionListItem["recurring"]>): string {
  return recurring.totalOccurrences == null
    ? "Recurring"
    : `Recurring (${recurring.fulfillmentPosition}/${recurring.totalOccurrences})`;
}

function RecurringMarker({
  recurring,
}: {
  recurring: NonNullable<TransactionListItem["recurring"]>;
}) {
  const label = recurringHoverLabel(recurring);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex shrink-0 text-muted-foreground" aria-label={label} />}
      >
        <HugeiconsIcon icon={RepeatIcon} className="size-3" strokeWidth={2} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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

function TransactionListRow({
  transaction,
  category,
  onEdit,
  onAdopt,
  onOpenRecurring,
  onDelete,
}: {
  transaction: TransactionListItem;
  category: TransactionCategory | undefined;
  onEdit: (transactionId: string) => void;
  onAdopt: (transaction: TransactionListItem) => void;
  onOpenRecurring: (recurringTransactionId: string) => void;
  onDelete: (transaction: TransactionListItem) => void;
}) {
  const transactionLabel = transaction.description || "No description";
  const categoryName = category?.name ?? "Uncategorized";
  const type = isTransactionType(transaction.transactionType)
    ? transaction.transactionType
    : undefined;
  const typeLabel = type ? TRANSACTION_TYPE_ARROWS[type].label : transaction.transactionType;
  const recurring = transaction.recurring;
  const rowClassName = "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left";
  const rowBody = (
    <>
      <CategoryIconTile category={category} />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              "truncate text-sm font-medium",
              !transaction.description && "italic text-muted-foreground",
            )}
          >
            {transaction.description || "No description"}
          </span>
          {recurring ? <RecurringMarker recurring={recurring} /> : null}
        </span>
        <time
          className="truncate text-xs text-muted-foreground"
          dateTime={transaction.transactionDate}
        >
          {`${formatTransactionRowDate(transaction.transactionDate)}, ${categoryName}`}
        </time>
      </span>
      <TransactionAmount transaction={transaction} />
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="flex items-center hover:bg-muted/50" />}>
        {recurring ? (
          <div className={rowClassName} aria-label={`${typeLabel}: ${transactionLabel}`}>
            {rowBody}
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              rowClassName,
              "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
            )}
            aria-label={`Edit ${typeLabel}: ${transactionLabel}`}
            onClick={() => {
              onEdit(transaction.id);
            }}
          >
            {rowBody}
          </button>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <ContextMenuGroup>
          {recurring ? (
            <ContextMenuItem onClick={() => onOpenRecurring(recurring.recurringTransactionId)}>
              <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
              View recurring
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuItem onClick={() => onAdopt(transaction)}>
                <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
                Make recurring
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onEdit(transaction.id)}>
                <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" strokeWidth={2} />
                Edit
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem variant="destructive" onClick={() => onDelete(transaction)}>
            <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" strokeWidth={2} />
            Delete
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function TransactionList({
  transactions,
  categoryById,
  onEdit,
  onAdopt,
  onOpenRecurring,
  onDelete,
}: TransactionListProps) {
  const groups = groupTransactionsByDay(transactions);

  return (
    <TooltipProvider>
      <div data-slot="transaction-list" className="flex flex-col gap-6">
        {groups.map((group) => {
          const headingId = `transaction-day-${group.dayKey}`;
          const dayTotal = formatTransactionDayTotal(group.transactions);

          return (
            <section key={group.dayKey} aria-labelledby={headingId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-3 text-muted-foreground">
                <h2 id={headingId} className="text-sm font-medium">
                  {group.heading}
                </h2>
                {dayTotal ? (
                  <p
                    className="font-mono text-sm font-medium tabular-nums"
                    aria-label={`Total ${dayTotal}`}
                  >
                    {dayTotal}
                  </p>
                ) : null}
              </div>
              <ul className="overflow-hidden rounded-lg border shadow-xs">
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
                        onOpenRecurring={onOpenRecurring}
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
    </TooltipProvider>
  );
}

export { TransactionList };
