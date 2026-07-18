import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import { paginatedTransactionsSchema, transactionSchema } from "../types/model";

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

export const TRANSACTION_COMMANDS = {
  get_transaction: backendCommand("get_transaction", transactionSchema),
  get_transactions: backendCommand("get_transactions", paginatedTransactionsSchema),
  get_filtered_transaction_ids: backendCommand("get_filtered_transaction_ids", z.array(z.string())),
  export_transactions_csv: backendCommand("export_transactions_csv", z.object({ csv: z.string() })),
  find_existing_duplicate_keys: backendCommand("find_existing_duplicate_keys", z.array(z.string())),
  create_transaction: backendCommand("create_transaction", transactionSchema),
  update_transaction: backendCommand("update_transaction", transactionSchema),
  delete_transaction: backendCommand("delete_transaction", transactionSchema),
  delete_transactions: backendCommand("delete_transactions", transactionArraySchema),
  import_transactions: backendCommand("import_transactions", transactionArraySchema),
  import_transaction_batch: backendCommand("import_transaction_batch", transactionArraySchema),
} as const;

export const TRANSACTION_BACKEND_COMMANDS = Object.values(
  TRANSACTION_COMMANDS,
) as Array<CommandDescriptor>;
