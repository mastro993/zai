import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { Budget, BudgetFormValues, BudgetHistory, BudgetListFilter } from "../types/budget";

export const getBudgets = (filter: BudgetListFilter = "active"): CommandResult<Array<Budget>> => {
  return invokeCommand<Array<Budget>>("get_budgets", filter === "active" ? undefined : { filter });
};

export const getBudget = (budgetId: string): CommandResult<Budget> => {
  return invokeCommand<Budget>("get_budget", { budgetId });
};

export const createBudget = (values: BudgetFormValues): CommandResult<Budget> => {
  return invokeCommand<Budget>("create_budget", {
    newBudget: {
      name: values.name,
      baseAllowance: values.baseAllowance,
      cadence: values.cadence,
      categoryIds: values.categoryIds,
      measurementMode: values.measurementMode,
      rolloverMode: values.rolloverMode,
      warningPercentage: values.warningPercentage,
    },
  });
};

export const updateBudget = (
  budgetId: string,
  expectedRevision: number,
  values: BudgetFormValues,
): CommandResult<Budget> => {
  return invokeCommand<Budget>("update_budget", {
    budgetId,
    updatedBudget: {
      expectedRevision,
      name: values.name,
      baseAllowance: values.baseAllowance,
      cadence: values.cadence,
      categoryIds: values.categoryIds,
      measurementMode: values.measurementMode,
      rolloverMode: values.rolloverMode,
      warningPercentage: values.warningPercentage,
    },
  });
};

export const getBudgetHistory = (
  budgetId: string,
  page = 1,
  perPage = 50,
): CommandResult<BudgetHistory> => {
  return invokeCommand<BudgetHistory>("get_budget_history", { budgetId, page, perPage });
};

export const pauseBudget = (budgetId: string, expectedRevision: number): CommandResult<Budget> => {
  return invokeCommand<Budget>("pause_budget", { budgetId, expectedRevision });
};

export const resumeBudget = (budgetId: string, expectedRevision: number): CommandResult<Budget> => {
  return invokeCommand<Budget>("resume_budget", { budgetId, expectedRevision });
};
