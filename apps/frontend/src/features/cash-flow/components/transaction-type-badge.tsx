import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";

import { TRANSACTION_TYPE_DISPLAY, isTransactionType } from "../lib/transaction-type-display";

const TRANSACTION_TYPE_ICONS = {
  income: ArrowUp01Icon,
  expense: ArrowDown01Icon,
} as const;

function TransactionTypeBadge({ type }: { type: string }) {
  if (!isTransactionType(type)) {
    return (
      <Badge variant="outline" className="capitalize">
        {type}
      </Badge>
    );
  }

  const { label, badgeVariant } = TRANSACTION_TYPE_DISPLAY[type];

  return (
    <Badge variant={badgeVariant}>
      <HugeiconsIcon icon={TRANSACTION_TYPE_ICONS[type]} strokeWidth={2} data-icon="inline-start" />
      {label}
    </Badge>
  );
}

export { TransactionTypeBadge };
