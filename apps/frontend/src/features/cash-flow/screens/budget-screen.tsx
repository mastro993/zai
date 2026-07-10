import { Result } from "@praha/byethrow";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

import { createBudget, getBudgets } from "../commands/budgets";
import { BudgetFormDrawer } from "../components/budget-form-drawer";
import { BudgetList, BudgetListSkeleton } from "../components/budget-list";
import type { Budget, BudgetFormValues } from "../types/budget-types";
import type { TransactionCategory } from "../types/model";

type BudgetScreenProps = {
  initialBudgets: Array<Budget>;
  categories: Array<TransactionCategory>;
};

export function BudgetScreen({ initialBudgets, categories }: BudgetScreenProps) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadBudgets = async () => {
    setIsLoading(true);
    const result = await getBudgets("active");

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsLoading(false);
      return false;
    }

    setBudgets(result.value);
    setErrorMessage(null);
    setIsLoading(false);
    return true;
  };

  const submitBudget = async (values: BudgetFormValues) => {
    const result = await createBudget(values);

    if (Result.isFailure(result)) {
      toast.error("Failed to save budget", { description: result.error.message });
      return;
    }

    setIsFormDrawerOpen(false);
    const refreshed = await loadBudgets();
    toast.success("Budget saved", {
      description: refreshed ? undefined : "Reload failed. Refresh the page to update the list.",
    });
  };

  return (
    <ScreenBase actions={<Button onClick={() => setIsFormDrawerOpen(true)}>New budget</Button>}>
      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <BudgetListSkeleton />
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No budgets yet</p>
            <p className="text-sm text-muted-foreground">
              Create a budget to track spending against your categories.
            </p>
          </div>
          <Button onClick={() => setIsFormDrawerOpen(true)}>New budget</Button>
        </div>
      ) : (
        <BudgetList budgets={budgets} />
      )}

      <Drawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setIsFormDrawerOpen(false);
          }
        }}
        swipeDirection="right"
      >
        {isFormDrawerOpen ? (
          <BudgetFormDrawer key="create-budget" categories={categories} onSubmit={submitBudget} />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
