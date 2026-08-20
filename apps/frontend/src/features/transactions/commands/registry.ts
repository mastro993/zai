import { z } from "zod";

import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";

import { boundImportPreviewSchema, commitTransactionImportResponseSchema } from "../types/import";
import {
  paginatedTransactionsSchema,
  transactionListItemSchema,
  transactionSchema,
} from "../types/model";
import {
  buildCommitTransactionImportRequest,
  buildCreateTransactionRequest,
  buildDeleteTransactionRequest,
  buildDeleteTransactionsRequest,
  buildExportTransactionsRequest,
  buildFindDuplicateKeysRequest,
  buildGetFilteredTransactionIdsRequest,
  buildGetTransactionImportPreviewRequest,
  buildGetTransactionRequest,
  buildGetTransactionsRequest,
  buildPreviewTransactionImportRequest,
  buildUpdateTransactionRequest,
} from "./web-requests";

const transactionListItemArraySchema = z.array(transactionListItemSchema);

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
    transactionListItemArraySchema,
    buildDeleteTransactionsRequest,
  ),
  preview_transaction_import: backendCommand(
    "preview_transaction_import",
    boundImportPreviewSchema,
    buildPreviewTransactionImportRequest,
  ),
  get_transaction_import_preview: backendCommand(
    "get_transaction_import_preview",
    boundImportPreviewSchema,
    buildGetTransactionImportPreviewRequest,
  ),
  commit_transaction_import: backendCommand(
    "commit_transaction_import",
    commitTransactionImportResponseSchema,
    buildCommitTransactionImportRequest,
  ),
} as const;

export const TRANSACTION_BACKEND_COMMANDS = Object.values(TRANSACTION_COMMANDS);
