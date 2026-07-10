import { formatAmountFromMinor } from "../lib/transaction";
import { formatBudgetScope, getBudgetCadenceLabel } from "../lib/budget";
import type { Budget } from "../types/budget-types";

function BudgetCard({ budget }: { budget: Budget }) {
  const period = budget.currentPeriod;
  const spent = period ? Math.max(period.activity, 0) : 0;
  const allowance = period?.allowance ?? 0;
  const available = period?.available ?? allowance;
  const progress =
    allowance > 0 ? Math.min(100, Math.round((spent / allowance) * 100)) : spent > 0 ? 100 : 0;

  return (
    <article className="flex flex-col gap-3 border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium">{budget.name}</h2>
          <p className="text-sm text-muted-foreground">
            {getBudgetCadenceLabel(budget.cadence)} · {formatBudgetScope(budget.scope.targets)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="text-lg font-semibold tabular-nums">{formatAmountFromMinor(available)}</p>
        </div>
      </div>

      <div className="h-2 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Spent</dt>
          <dd className="font-medium tabular-nums">{formatAmountFromMinor(spent)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Allowance</dt>
          <dd className="font-medium tabular-nums">{formatAmountFromMinor(allowance)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Activity</dt>
          <dd className="font-medium tabular-nums">
            {formatAmountFromMinor(period?.activity ?? 0)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function BudgetList({ budgets }: { budgets: Array<Budget> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {budgets.map((budget) => (
        <BudgetCard key={budget.id} budget={budget} />
      ))}
    </div>
  );
}

function BudgetListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(["budget-skeleton-1", "budget-skeleton-2", "budget-skeleton-3"] as const).map((key) => (
        <div key={key} className="h-40 animate-pulse border bg-muted/40" />
      ))}
    </div>
  );
}

export { BudgetList, BudgetListSkeleton };
