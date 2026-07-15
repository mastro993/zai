import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import { budgetHistorySchema, budgetSchema } from "../types/budget";
import { categorySchema, paginatedTransactionsSchema, transactionSchema } from "../types/model";

const budgetArraySchema = z.array(budgetSchema);
const categoryArraySchema = z.array(categorySchema);
const transactionArraySchema = z.array(transactionSchema);

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

export const CASH_FLOW_COMMANDS = {
  get_budgets: backendCommand("get_budgets", budgetArraySchema),
  get_budget: backendCommand("get_budget", budgetSchema),
  create_budget: backendCommand("create_budget", budgetSchema),
  update_budget: backendCommand("update_budget", budgetSchema),
  delete_budget: voidBackendCommand("delete_budget"),
  get_budget_history: backendCommand("get_budget_history", budgetHistorySchema),
  pause_budget: backendCommand("pause_budget", budgetSchema),
  resume_budget: backendCommand("resume_budget", budgetSchema),
  get_transaction_category: backendCommand("get_transaction_category", categorySchema),
  get_transaction_categories: backendCommand("get_transaction_categories", categoryArraySchema),
  create_transaction_category: backendCommand("create_transaction_category", categorySchema),
  update_transaction_category: backendCommand("update_transaction_category", categorySchema),
  delete_transaction_categories: backendCommand(
    "delete_transaction_categories",
    categoryArraySchema,
  ),
  import_transaction_categories: backendCommand(
    "import_transaction_categories",
    categoryArraySchema,
  ),
  get_transaction: backendCommand("get_transaction", transactionSchema),
  get_transactions: backendCommand("get_transactions", paginatedTransactionsSchema),
  create_transaction: backendCommand("create_transaction", transactionSchema),
  update_transaction: backendCommand("update_transaction", transactionSchema),
  delete_transaction: backendCommand("delete_transaction", transactionSchema),
  delete_transactions: backendCommand("delete_transactions", transactionArraySchema),
  import_transactions: backendCommand("import_transactions", transactionArraySchema),
  import_transaction_batch: backendCommand("import_transaction_batch", transactionArraySchema),
} as const;

export const CASH_FLOW_BACKEND_COMMANDS = Object.values(
  CASH_FLOW_COMMANDS,
) as Array<CommandDescriptor>;

export const CASH_FLOW_DESKTOP_ONLY_COMMANDS = [
  {
    name: "selectCsvImportFile",
    transport: "desktop-only",
    resultSchema: "void",
    webMapped: false,
  },
  {
    name: "downloadTextFile",
    transport: "desktop-only",
    resultSchema: "void",
    webMapped: false,
  },
] as const satisfies ReadonlyArray<CommandDescriptor>;

export const CASH_FLOW_COMMAND_REGISTRY = [
  ...CASH_FLOW_BACKEND_COMMANDS,
  ...CASH_FLOW_DESKTOP_ONLY_COMMANDS,
] as const;
