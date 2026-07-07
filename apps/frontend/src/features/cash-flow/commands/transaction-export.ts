import { R } from "@praha/byethrow";

import type { CommandResult } from "@/commands/shared";

import {
  getTransactionExportFilename,
  toTransactionExportCsv,
} from "../lib/transaction-export";
import type { Transaction, TransactionCategory } from "../types/model";

const toExportError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

const appendPath = (directory: string, filename: string) => {
  if (directory.endsWith("/") || directory.endsWith("\\")) {
    return `${directory}${filename}`;
  }

  return `${directory}${directory.includes("\\") ? "\\" : "/"}${filename}`;
};

export const exportTransactions = (
  transactions: Array<Transaction>,
  categories: Array<TransactionCategory>,
): CommandResult<string | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      R.fail(new Error("Transaction export is only available in the desktop app")),
    );
  }

  return R.try({
    try: async () => {
      const [{ save }, { writeTextFile }, { documentDir }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
        import("@tauri-apps/api/path"),
      ]);
      const outputPath = await save({
        title: "Export transactions",
        defaultPath: appendPath(await documentDir(), getTransactionExportFilename()),
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (!outputPath) {
        return null;
      }

      await writeTextFile(outputPath, toTransactionExportCsv(transactions, categories));

      return outputPath;
    },
    catch: toExportError,
  });
};
