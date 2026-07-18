import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type { Budget, BudgetFormValues, BudgetHistory, BudgetListFilter } from "../types/budget";
import { BUDGET_COMMANDS } from "./registry";

export const getBudgets = (filter: BudgetListFilter = "active"): CommandResult<Array<Budget>> => {
  return invokeDecodedCommand(
    BUDGET_COMMANDS.get_budgets,
    filter === "active" ? undefined : { filter },
  );
};

export const getBudget = (budgetId: string): CommandResult<Budget> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.get_budget, { budgetId });
};

export const createBudget = (values: BudgetFormValues): CommandResult<Budget> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.create_budget, {
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
  return invokeDecodedCommand(BUDGET_COMMANDS.update_budget, {
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

export const deleteBudget = (budgetId: string, expectedRevision: number): CommandResult<void> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.delete_budget, { budgetId, expectedRevision });
};

export const getBudgetHistory = (
  budgetId: string,
  page = 1,
  perPage = 50,
): CommandResult<BudgetHistory> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.get_budget_history, { budgetId, page, perPage });
};

export const pauseBudget = (budgetId: string, expectedRevision: number): CommandResult<Budget> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.pause_budget, { budgetId, expectedRevision });
};

export const resumeBudget = (budgetId: string, expectedRevision: number): CommandResult<Budget> => {
  return invokeDecodedCommand(BUDGET_COMMANDS.resume_budget, { budgetId, expectedRevision });
};
