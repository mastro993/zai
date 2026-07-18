import { Badge } from "@/components/ui/badge";
import {
  budgetStatusLabel,
  budgetStatusVariant,
  formatBudgetPeriod,
} from "@/features/budgets/lib/budget";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  BUDGET_STATUS_RICH_KIND,
  BUDGET_STATUS_RICH_VERSION,
  parseBudgetStatusRichDataV1,
  toBudgetStatus,
} from "../types/budget-status-rich-data";
import type { DomainAlertRichData } from "../types/domain-alert";

interface BudgetStatusAlertSnapshotProps {
  data: DomainAlertRichData;
}

export function BudgetStatusAlertSnapshot({ data }: BudgetStatusAlertSnapshotProps) {
  if (data.kind !== BUDGET_STATUS_RICH_KIND || data.version !== BUDGET_STATUS_RICH_VERSION) {
    return null;
  }

  const snapshot = parseBudgetStatusRichDataV1(data.payload);
  if (!snapshot) {
    return null;
  }

  const status = toBudgetStatus(snapshot.status);

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Status</span>
        <Badge
          variant={budgetStatusVariant(status)}
          className="rounded-none px-1.5 py-0 text-[10px]"
        >
          {budgetStatusLabel[status]}
        </Badge>
      </div>
      <p className="text-muted-foreground">
        Period {formatBudgetPeriod(snapshot.periodStart, snapshot.periodEnd)}
      </p>
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Effective allowance</dt>
          <dd className="font-medium text-foreground">
            {formatCurrencyFromMinor(snapshot.effectiveAllowance, snapshot.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net budget spending</dt>
          <dd className="font-medium text-foreground">
            {formatCurrencyFromMinor(snapshot.netBudgetSpending, snapshot.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Remaining allowance</dt>
          <dd className="font-medium text-foreground">
            {formatCurrencyFromMinor(snapshot.remainingAllowance, snapshot.currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
