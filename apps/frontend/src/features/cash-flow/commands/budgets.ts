import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { Budget, BudgetFormValues, BudgetListStatus } from "../types/budget-types";

type CreateBudgetPayload = {
  name: string;
  allowance: number;
  cadence: BudgetFormValues["cadence"];
  categoryIds: Array<string>;
};

const toCreateBudgetPayload = (values: BudgetFormValues): CreateBudgetPayload => ({
  name: values.name,
  allowance: values.allowance,
  cadence: values.cadence,
  categoryIds: values.categoryIds,
});

export const getBudgets = (status: BudgetListStatus = "active"): CommandResult<Array<Budget>> => {
  return invokeCommand<Array<Budget>>("get_budgets", {
    filters: { status },
  });
};

export const getBudget = (budgetId: string): CommandResult<Budget> => {
  return invokeCommand<Budget>("get_budget", { budgetId });
};

export const createBudget = (values: BudgetFormValues): CommandResult<Budget> => {
  return invokeCommand<Budget>("create_budget", {
    newBudget: toCreateBudgetPayload(values),
  });
};
