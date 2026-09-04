import { Add01Icon, Wallet03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScreenBase } from "@/components/screen-base";

import { createBudget, getBudgets } from "../commands/budgets";
import {
  budgetCadenceLabel,
  budgetListFilterLabel,
  budgetPeriodStatusPresentation,
  formatBudgetMinor,
  formatBudgetPeriod,
} from "../lib/budget";
import {
  BUDGET_LIST_FILTERS,
  type Budget,
  type BudgetFormValues,
  type BudgetListFilter,
} from "../types/budget";
import type { TransactionCategory } from "@/features/categories/types/model";
import { BudgetFormDrawer } from "../components/budget-form-drawer";

interface BudgetScreenProps {
  initialBudgets: Array<Budget>;
  categories: Array<TransactionCategory>;
}

const formatScope = (categoryIds: Array<string>) =>
  categoryIds.length === 0 ? "All transactions" : `${categoryIds.length} categories`;

function BudgetRows({ budgets }: { budgets: Array<Budget> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Budget</TableHead>
          <TableHead>Cadence / period</TableHead>
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
              <div className="flex items-center gap-2">
                <Link
                  className="underline-offset-3 hover:underline"
                  to="/cash-flow/budgets/$budgetId"
                  params={{ budgetId: budget.id }}
                >
                  {budget.name}
                </Link>
                {budget.paused ? <Badge variant="secondary">Paused</Badge> : null}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span>{budgetCadenceLabel[budget.cadence]}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBudgetPeriod(budget.currentPeriod.start, budget.currentPeriod.end)}
                </span>
              </div>
            </TableCell>
            <TableCell>{formatScope(budget.categoryIds)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBudgetMinor(
                budget.currentPeriod.effectiveAllowance,
                budget.currentPeriod.currency,
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBudgetMinor(
                budget.currentPeriod.netBudgetSpending,
                budget.currentPeriod.currency,
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBudgetMinor(
                budget.currentPeriod.remainingAllowance,
                budget.currentPeriod.currency,
              )}
            </TableCell>
            <TableCell>
              <Badge variant={budgetPeriodStatusPresentation(budget.currentPeriod).variant}>
                {budgetPeriodStatusPresentation(budget.currentPeriod).label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function BudgetScreen({ initialBudgets, categories }: BudgetScreenProps) {
  const [budgets, setBudgets] = useState(() => initialBudgets.filter((budget) => !budget.paused));
  const [hasAnyBudgets, setHasAnyBudgets] = useState(initialBudgets.length > 0);
  const [filter, setFilter] = useState<BudgetListFilter>("active");
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<string>();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const changeFilter = async (nextFilter: string) => {
    const typedFilter = BUDGET_LIST_FILTERS.find((candidate) => candidate === nextFilter);
    if (!typedFilter || typedFilter === filter || isListLoading) {
      return;
    }
    const previousFilter = filter;
    setFilter(typedFilter);
    setIsListLoading(true);
    setListError(undefined);
    const result = await getBudgets(typedFilter);
    if (Result.isSuccess(result)) {
      setBudgets(result.value);
      if (typedFilter === "all") {
        setHasAnyBudgets(result.value.length > 0);
      }
    } else {
      setFilter(previousFilter);
      setListError(result.error.message);
    }
    setIsListLoading(false);
  };

  const submitBudget = async (values: BudgetFormValues) => {
    const result = await createBudget(values);
    if (Result.isSuccess(result)) {
      setHasAnyBudgets(true);
      if (filter !== "paused") {
        setBudgets((current) =>
          [...current, result.value].toSorted((left, right) => left.name.localeCompare(right.name)),
        );
      }
    }
    return result;
  };

  return (
    <ScreenBase>
      {hasAnyBudgets ? (
        <div className="flex items-center justify-between gap-2">
          <Tabs
            className="w-fit"
            value={filter}
            onValueChange={(value) => void changeFilter(value)}
          >
            <TabsList aria-label="Budget filter">
              {BUDGET_LIST_FILTERS.map((value) => (
                <TabsTrigger key={value} value={value} disabled={isListLoading}>
                  {budgetListFilterLabel[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsFormOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add budget
          </Button>
        </div>
      ) : null}
      {listError ? (
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {listError}
        </p>
      ) : null}
      {isListLoading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading budgets...
        </p>
      ) : null}
      {budgets.length === 0 ? (
        <Empty
          role="region"
          aria-labelledby="budget-empty-state-title"
          className="flex-none min-h-72 rounded-lg border px-6 py-10 sm:px-8"
        >
          <EmptyHeader className="max-w-md gap-1.5">
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Wallet03Icon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle
              id="budget-empty-state-title"
              role="heading"
              aria-level={2}
              className="text-base"
            >
              {filter === "active" ? "No active budgets" : `No ${filter} budgets`}
            </EmptyTitle>
            <EmptyDescription>
              {filter === "active"
                ? "Create a budget for any cadence, category scope, or measurement mode."
                : "Change filter or create a budget to see it here."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-none flex-row flex-wrap justify-center">
            <Button onClick={() => setIsFormOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Add budget
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="border" aria-busy={isListLoading}>
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Budgets</div>
          <BudgetRows budgets={budgets} />
        </div>
      )}
      <Drawer open={isFormOpen} onOpenChange={setIsFormOpen} swipeDirection="right">
        <BudgetFormDrawer
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={submitBudget}
          categories={categories}
        />
      </Drawer>
    </ScreenBase>
  );
}

export function BudgetScreenSkeleton() {
  return (
    <ScreenBase>
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
