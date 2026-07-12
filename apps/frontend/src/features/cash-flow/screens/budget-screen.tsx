import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";

import { createBudget } from "../commands/budgets";
import { budgetStatusLabel, budgetStatusVariant } from "../lib/budget";
import { type Budget, type BudgetFormValues } from "../types/budget";
import { BudgetFormDialog } from "../components/budget-form-dialog";

interface BudgetScreenProps {
  initialBudgets: Array<Budget>;
}

const formatPeriod = (value: string) => {
  const [year, month] = value.slice(0, 7).split("-");
  return `${year}-${month}`;
};

function BudgetRows({ budgets }: { budgets: Array<Budget> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Budget</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className="text-right">Allowance</TableHead>
          <TableHead className="text-right">Spending</TableHead>
          <TableHead className="text-right">Remaining</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {budgets.map((budget) => (
          <TableRow key={budget.id}>
            <TableCell className="font-medium">
              <Link
                className="underline-offset-3 hover:underline"
                to="/cash-flow/budgets/$budgetId"
                params={{ budgetId: budget.id }}
              >
                {budget.name}
              </Link>
            </TableCell>
            <TableCell>{formatPeriod(budget.currentPeriod.start)}</TableCell>
            <TableCell>All transactions</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrencyFromMinor(budget.currentPeriod.effectiveAllowance, "EUR")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrencyFromMinor(budget.currentPeriod.netBudgetSpending, "EUR")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrencyFromMinor(budget.currentPeriod.remainingAllowance, "EUR")}
            </TableCell>
            <TableCell>
              <Badge variant={budgetStatusVariant(budget.currentPeriod.status)}>
                {budgetStatusLabel[budget.currentPeriod.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function BudgetScreen({ initialBudgets }: BudgetScreenProps) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitBudget = async (values: BudgetFormValues) => {
    const result = await createBudget(values);
    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      return false;
    }

    setBudgets((current) =>
      [...current, result.value].toSorted((left, right) => left.name.localeCompare(right.name)),
    );
    setErrorMessage(null);
    return true;
  };

  return (
    <ScreenBase actions={<Button onClick={() => setIsFormOpen(true)}>New budget</Button>}>
      <h1 className="text-2xl font-medium">Budgets</h1>
      {errorMessage ? (
        <div
          role="alert"
          className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}
      {budgets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No budgets yet</p>
            <p className="text-sm text-muted-foreground">
              Create a monthly spending target to track current cash flow.
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>New budget</Button>
        </div>
      ) : (
        <div className="border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Budgets</div>
          <BudgetRows budgets={budgets} />
        </div>
      )}
      <BudgetFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} onSubmit={submitBudget} />
    </ScreenBase>
  );
}

export function BudgetScreenSkeleton() {
  return (
    <ScreenBase>
      <h1 className="text-2xl font-medium">Budgets</h1>
      <div className="border">
        <div className="border-b bg-muted/40 px-3 py-2">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </ScreenBase>
  );
}

export function BudgetErrorScreen({ message }: { message: string }) {
  return (
    <ScreenBase>
      <div
        role="alert"
        className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      >
        {message}
      </div>
    </ScreenBase>
  );
}
