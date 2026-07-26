import { z } from "zod";

import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";

import { paginatedTransactionsSchema, transactionSchema } from "../types/model";
import {
  buildCreateTransactionRequest,
  buildDeleteTransactionRequest,
  buildDeleteTransactionsRequest,
  buildExportTransactionsRequest,
  buildFindDuplicateKeysRequest,
  buildGetFilteredTransactionIdsRequest,
  buildGetTransactionRequest,
  buildGetTransactionsRequest,
  buildImportTransactionBatchRequest,
  buildImportTransactionsRequest,
  buildUpdateTransactionRequest,
} from "./web-requests";

const transactionArraySchema = z.array(transactionSchema);

const backendCommand = <TArgs, T>(
  name: string,
  resultSchema: z.ZodType<T>,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs, T>>[2],
): CommandDescriptor<TArgs, T> => createCommandDescriptor(name, resultSchema, webRequest);

export const TRANSACTION_COMMANDS = {
  get_transaction: backendCommand("get_transaction", transactionSchema, buildGetTransactionRequest),
  get_transactions: backendCommand(
    "get_transactions",
    paginatedTransactionsSchema,
    buildGetTransactionsRequest,
  ),
  get_filtered_transaction_ids: backendCommand(
    "get_filtered_transaction_ids",
    z.array(z.string()),
    buildGetFilteredTransactionIdsRequest,
  ),
  export_transactions_csv: backendCommand(
    "export_transactions_csv",
    z.object({ csv: z.string() }),
    buildExportTransactionsRequest,
  ),
  find_existing_duplicate_keys: backendCommand(
    "find_existing_duplicate_keys",
    z.array(z.string()),
    buildFindDuplicateKeysRequest,
  ),
  create_transaction: backendCommand(
    "create_transaction",
    transactionSchema,
    buildCreateTransactionRequest,
  ),
  update_transaction: backendCommand(
    "update_transaction",
    transactionSchema,
    buildUpdateTransactionRequest,
  ),
  delete_transaction: backendCommand(
    "delete_transaction",
    transactionSchema,
    buildDeleteTransactionRequest,
  ),
  delete_transactions: backendCommand(
    "delete_transactions",
    transactionArraySchema,
    buildDeleteTransactionsRequest,
  ),
  import_transactions: backendCommand(
    "import_transactions",
    transactionArraySchema,
    buildImportTransactionsRequest,
  ),
  import_transaction_batch: backendCommand(
    "import_transaction_batch",
    transactionArraySchema,
    buildImportTransactionBatchRequest,
  ),
} as const;

export const TRANSACTION_BACKEND_COMMANDS = Object.values(
  TRANSACTION_COMMANDS,
) as unknown as Array<CommandDescriptor>;
