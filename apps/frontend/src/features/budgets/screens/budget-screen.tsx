import {
  Add01Icon,
  Alert02Icon,
  GridViewIcon,
  InformationCircleIcon,
  Wallet03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { ScreenBase } from "@/components/screen-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
} from "@/features/categories/lib/category";
import { getCategoryBadgeColors } from "@/features/categories/lib/category-color";
import { getCategoryIconEntry } from "@/features/categories/lib/category-icon";
import type { TransactionCategory } from "@/features/categories/types/model";
import { cn } from "@/lib/utils";

import { createBudget, getBudgets } from "../commands/budgets";
import { BudgetFormDrawer } from "../components/budget-form-drawer";
import { budgetListFilterLabel, formatBudgetMinor } from "../lib/budget";
import { createBudgetChartData, type BudgetChartData } from "../lib/budget-chart";
import {
  BUDGET_LIST_FILTERS,
  type Budget,
  type BudgetFormValues,
  type BudgetListFilter,
  type BudgetOverview,
} from "../types/budget";

interface BudgetScreenProps {
  initialBudgets: Array<BudgetOverview>;
  categories: Array<TransactionCategory>;
}

export interface BudgetCardData {
  budget: BudgetOverview;
  allowanceLabel: string;
  spendingLabel: string;
  remainingLabel: string;
  percentage: number | null;
  chart: BudgetChartData;
}

const budgetCadenceBadgeLabel = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
} satisfies Record<Budget["cadence"], string>;

const buildBudgetCardData = (budget: BudgetOverview): BudgetCardData => {
  const period = budget.currentPeriod;
  const allowance = period.effectiveAllowance;
  const percentage =
    allowance !== null && allowance > 0
      ? Math.round((period.netBudgetSpending / allowance) * 100)
      : null;
  return {
    budget,
    allowanceLabel: formatBudgetMinor(allowance, period.currency),
    spendingLabel: formatBudgetMinor(period.netBudgetSpending, period.currency),
    remainingLabel: formatBudgetMinor(period.remainingAllowance, period.currency),
    percentage,
    chart: createBudgetChartData(budget),
  };
};

function BudgetStatusBadge({ budget }: { budget: Budget }) {
  if (budget.currentPeriod.status === "onTrack") {
    return null;
  }

  if (budget.currentPeriod.status === "warning") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="secondary"
              className="size-5 bg-amber-500/10 p-0 text-amber-600 dark:bg-amber-400/15 dark:text-amber-500"
              aria-label="Warning"
            />
          }
        >
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Warning</TooltipContent>
      </Tooltip>
    );
  }

  if (budget.currentPeriod.status === "overspent") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<Badge variant="destructive" className="size-5 p-0" aria-label="Overspent" />}
        >
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Overspent</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge variant="outline">
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} aria-hidden="true" />
      Incomplete
    </Badge>
  );
}

function BudgetPaceChart({ budget, chart }: { budget: Budget; chart: BudgetChartData }) {
  const chartId = `budget-chart-${budget.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const xAxisLabels = new Map(chart.labels.map((label) => [label.position, label.label]));
  const yAxisLabels = new Map(chart.yAxisLabels.map((label) => [label.value, label.label]));
  return (
    <figure
      className="h-40"
      role="img"
      aria-label={`${budget.name} budget progress. ${chart.summary}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart.points} margin={{ top: 8, right: 0, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`${chartId}-area-gradient`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="position"
            type="number"
            domain={[0, 1]}
            ticks={chart.labels.map((label) => label.position)}
            tickFormatter={(value) => xAxisLabels.get(Number(value)) ?? ""}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 10,
              opacity: 0.5,
            }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={chart.yAxisDomain}
            ticks={chart.yAxisLabels.map((label) => label.value)}
            tickFormatter={(value) => yAxisLabels.get(Number(value)) ?? ""}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 10,
              opacity: 0.5,
            }}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={35}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-2)"
            strokeWidth={3}
            fill={`url(#${chartId}-area-gradient)`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

function BudgetCategoryScope({
  categoryIds,
  categoryById,
}: {
  categoryIds: Array<string>;
  categoryById: ReadonlyMap<string, TransactionCategory>;
}) {
  if (categoryIds.length === 0) {
    return (
      <CardDescription>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                aria-label="All categories"
                className="relative flex size-6 items-center justify-center rounded-full border-[0.5px]"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--muted) 30%, var(--background))",
                  borderColor: "color-mix(in oklab, var(--muted) 30%, var(--background))",
                }}
                title="All categories"
              />
            }
          >
            <span aria-hidden="true" className="absolute inset-0.5 rounded-full bg-primary/10" />
            <HugeiconsIcon
              icon={GridViewIcon}
              className="relative size-3 text-primary"
              strokeWidth={2}
              aria-hidden="true"
            />
          </TooltipTrigger>
          <TooltipContent>All categories</TooltipContent>
        </Tooltip>
      </CardDescription>
    );
  }

  const selectedCategories = categoryIds
    .map((categoryId) => categoryById.get(categoryId))
    .filter((category): category is TransactionCategory => category !== undefined);

  if (selectedCategories.length === 0) {
    return <CardDescription>{`${categoryIds.length} categories`}</CardDescription>;
  }

  const visibleCategories = selectedCategories.slice(0, 4);
  const remainingCount = selectedCategories.length - visibleCategories.length;
  const categoryLabel = `Categories: ${visibleCategories.map((category) => category.name).join(", ")}${remainingCount > 0 ? `, ${remainingCount} more` : ""}`;

  return (
    <CardDescription>
      <div className="flex items-center" role="img" aria-label={categoryLabel}>
        {visibleCategories.map((category, index) => {
          const { background, foreground } = getCategoryBadgeColors(
            getCategoryDisplayColor(category),
          );
          const icon = getCategoryIconEntry(getCategoryDisplayIcon(category)).icon;

          return (
            <Tooltip key={category.id}>
              <TooltipTrigger
                render={
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative flex size-6 items-center justify-center rounded-full border-[0.5px]",
                      index > 0 && "-ml-1.5",
                    )}
                    style={{
                      backgroundColor: "color-mix(in oklab, var(--muted) 30%, var(--background))",
                      borderColor: "color-mix(in oklab, var(--muted) 30%, var(--background))",
                      color: foreground,
                      zIndex: visibleCategories.length - index,
                    }}
                    title={category.name}
                  />
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0.5 rounded-full"
                  style={{ backgroundColor: background }}
                />
                <HugeiconsIcon
                  icon={icon}
                  className="relative size-3"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </TooltipTrigger>
              <TooltipContent>{category.name}</TooltipContent>
            </Tooltip>
          );
        })}
        {remainingCount > 0 ? <span className="ml-1 text-xs">+{remainingCount}</span> : null}
      </div>
    </CardDescription>
  );
}

function BudgetCard({
  data,
  categoryById,
}: {
  data: BudgetCardData;
  categoryById: ReadonlyMap<string, TransactionCategory>;
}) {
  const { budget, percentage, chart } = data;
  return (
    <Link
      aria-label={budget.name}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to="/cash-flow/budgets/$budgetId"
      params={{ budgetId: budget.id }}
    >
      <Card className={cn("min-w-0 bg-muted/30", budget.paused && "border border-dashed ring-0")}>
        <CardHeader className="gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="min-w-0 break-words text-base">{budget.name}</CardTitle>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <BudgetStatusBadge budget={budget} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {budget.paused ? <Badge variant="secondary">Paused</Badge> : null}
            <Badge variant="secondary">{budgetCadenceBadgeLabel[budget.cadence]}</Badge>
            <BudgetCategoryScope categoryIds={budget.categoryIds} categoryById={categoryById} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Spending</span>
              <span className="text-2xl font-semibold tabular-nums">{data.spendingLabel}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">of {data.allowanceLabel}</span>
              <span className="block text-lg font-medium tabular-nums">
                {percentage === null ? "Progress unavailable" : `${percentage}%`}
              </span>
            </div>
          </div>
          <BudgetPaceChart budget={budget} chart={chart} />
          <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
            <div className="flex min-w-0 flex-col gap-1 rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">Allowance</dt>
              <dd className="truncate font-medium tabular-nums">{data.allowanceLabel}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">Spent</dt>
              <dd className="truncate font-medium tabular-nums">{data.spendingLabel}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">Remaining</dt>
              <dd className="truncate font-medium tabular-nums">{data.remainingLabel}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}

function BudgetCards({
  budgets,
  categories,
}: {
  budgets: Array<BudgetOverview>;
  categories: Array<TransactionCategory>;
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <TooltipProvider>
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
        role="region"
        aria-label="Budgets"
      >
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            data={buildBudgetCardData(budget)}
            categoryById={categoryById}
          />
        ))}
      </div>
    </TooltipProvider>
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
        const refreshed = await getBudgets(filter);
        if (Result.isSuccess(refreshed)) {
          setBudgets(refreshed.value);
        } else {
          setListError(refreshed.error.message);
        }
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
        <div aria-busy={isListLoading}>
          <BudgetCards budgets={budgets} categories={categories} />
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
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
