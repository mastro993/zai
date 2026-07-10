import { Result } from "@praha/byethrow";

import { downloadTextFile } from "@/commands/file-capabilities/download-text-file";
import { CommandError, type CommandResult, toCommandError } from "@/commands/shared";

import { getTransactionExportFilename, toTransactionExportCsv } from "../lib/transaction-export";
import type { Transaction, TransactionCategory } from "../types/model";

export const exportTransactions = (
  transactions: Array<Transaction>,
  categories: Array<TransactionCategory>,
): CommandResult<string | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      Result.fail(new CommandError("Transaction export is only available in the client")),
    );
  }

  return Result.try({
    try: () =>
      downloadTextFile({
        title: "Export transactions",
        filename: getTransactionExportFilename(),
        content: toTransactionExportCsv(transactions, categories),
      }),
    catch: toCommandError,
  });
};
