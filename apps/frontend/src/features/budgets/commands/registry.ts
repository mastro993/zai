import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import { budgetHistorySchema, budgetSchema } from "../types/budget";

const budgetArraySchema = z.array(budgetSchema);

const backendCommand = <T>(
  name: string,
  resultSchema: CommandDescriptor<T>["resultSchema"],
): CommandDescriptor<T> => ({
  name,
  transport: "backend",
  resultSchema,
  webMapped: true,
});

const voidBackendCommand = (name: string): CommandDescriptor<void> => backendCommand(name, "void");

export const BUDGET_COMMANDS = {
  get_budgets: backendCommand("get_budgets", budgetArraySchema),
  get_budget: backendCommand("get_budget", budgetSchema),
  create_budget: backendCommand("create_budget", budgetSchema),
  update_budget: backendCommand("update_budget", budgetSchema),
  delete_budget: voidBackendCommand("delete_budget"),
  get_budget_history: backendCommand("get_budget_history", budgetHistorySchema),
  pause_budget: backendCommand("pause_budget", budgetSchema),
  resume_budget: backendCommand("resume_budget", budgetSchema),
} as const;

export const BUDGET_BACKEND_COMMANDS = Object.values(BUDGET_COMMANDS) as Array<CommandDescriptor>;
