import { Result } from "@praha/byethrow";

import { downloadTextFile } from "@/commands/file-capabilities/download-text-file";
import { CommandError, type CommandResult, toCommandError } from "@/commands/shared";

import { getTransactionExportFilename } from "../lib/transaction-export";
import { exportTransactionsCsv, type TransactionFilters } from "./transactions";

export const exportTransactions = async (options?: {
  filters?: TransactionFilters;
  transactionIds?: Array<string>;
}): CommandResult<string | null> => {
  if (typeof window === "undefined") {
    return Result.fail(new CommandError("Transaction export is only available in the client"));
  }

  const csvResult = await exportTransactionsCsv(options);

  if (Result.isFailure(csvResult)) {
    return csvResult;
  }

  return Result.try({
    try: () =>
      downloadTextFile({
        title: "Export transactions",
        filename: getTransactionExportFilename(),
        content: csvResult.value.csv,
      }),
    catch: toCommandError,
  });
};
