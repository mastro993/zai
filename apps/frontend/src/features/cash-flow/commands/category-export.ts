import { Result } from "@praha/byethrow";

import { downloadTextFile } from "@/commands/file-capabilities/download-text-file";
import { CommandError, type CommandResult, toCommandError } from "@/commands/shared";

import { getCategoryExportFilename, toCategoryExportCsv } from "../lib/category-export";
import type { TransactionCategory } from "../types/model";

export const exportCategories = (
  categories: Array<TransactionCategory>,
): CommandResult<string | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      Result.fail(new CommandError("Category export is only available in the client")),
    );
  }

  return Result.try({
    try: () =>
      downloadTextFile({
        title: "Export categories",
        filename: getCategoryExportFilename(),
        content: toCategoryExportCsv(categories),
      }),
    catch: toCommandError,
  });
};
