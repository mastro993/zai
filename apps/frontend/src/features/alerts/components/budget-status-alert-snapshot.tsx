import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
    <Card size="sm" className="mt-3 text-xs">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardDescription className="text-xs">Status</CardDescription>
          <Badge variant={budgetStatusVariant(status)}>{budgetStatusLabel[status]}</Badge>
        </div>
        <CardDescription className="text-xs whitespace-nowrap">
          Period {formatBudgetPeriod(snapshot.periodStart, snapshot.periodEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Effective allowance</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatCurrencyFromMinor(snapshot.effectiveAllowance, snapshot.currency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Net budget spending</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatCurrencyFromMinor(snapshot.netBudgetSpending, snapshot.currency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Remaining allowance</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatCurrencyFromMinor(snapshot.remainingAllowance, snapshot.currency)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
