import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { Budget, BudgetFormValues } from "../types/budget";

export const getBudgets = (): CommandResult<Array<Budget>> => {
  return invokeCommand<Array<Budget>>("get_budgets");
};

export const getBudget = (budgetId: string): CommandResult<Budget> => {
  return invokeCommand<Budget>("get_budget", { budgetId });
};

export const createBudget = (values: BudgetFormValues): CommandResult<Budget> => {
  return invokeCommand<Budget>("create_budget", {
    newBudget: {
      name: values.name,
      baseAllowance: values.baseAllowance,
      measurementMode: "spending",
      warningPercentage: 80,
    },
  });
};
