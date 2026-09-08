import { z } from "zod";

import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";

import { budgetHistorySchema, budgetOverviewSchema, budgetSchema } from "../types/budget";
import {
  buildCreateBudgetRequest,
  buildDeleteBudgetRequest,
  buildGetBudgetHistoryRequest,
  buildGetBudgetRequest,
  buildGetBudgetsRequest,
  buildPauseBudgetRequest,
  buildResumeBudgetRequest,
  buildUpdateBudgetRequest,
} from "./web-requests";

const budgetOverviewArraySchema = z.array(budgetOverviewSchema);

const backendCommand = <TArgs, T>(
  name: string,
  resultSchema: z.ZodType<T>,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs, T>>[2],
): CommandDescriptor<TArgs, T> => createCommandDescriptor(name, resultSchema, webRequest);

const voidBackendCommand = <TArgs>(
  name: string,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs>>[2],
): CommandDescriptor<TArgs, void> => createCommandDescriptor(name, "void", webRequest);

export const BUDGET_COMMANDS = {
  get_budgets: backendCommand("get_budgets", budgetOverviewArraySchema, buildGetBudgetsRequest),
  get_budget: backendCommand("get_budget", budgetSchema, buildGetBudgetRequest),
  create_budget: backendCommand("create_budget", budgetSchema, buildCreateBudgetRequest),
  update_budget: backendCommand("update_budget", budgetSchema, buildUpdateBudgetRequest),
  delete_budget: voidBackendCommand("delete_budget", buildDeleteBudgetRequest),
  get_budget_history: backendCommand(
    "get_budget_history",
    budgetHistorySchema,
    buildGetBudgetHistoryRequest,
  ),
  pause_budget: backendCommand("pause_budget", budgetSchema, buildPauseBudgetRequest),
  resume_budget: backendCommand("resume_budget", budgetSchema, buildResumeBudgetRequest),
} as const;

export const BUDGET_BACKEND_COMMANDS = Object.values(BUDGET_COMMANDS);
