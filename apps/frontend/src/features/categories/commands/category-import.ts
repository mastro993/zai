import { Result } from "@praha/byethrow";

import { selectCsvImportFile } from "@/commands/file-capabilities/select-csv-import-file";
import type { ImportFileMetadata } from "@/commands/file-capabilities/types";
import { CommandError, type CommandResult, toCommandError } from "@/commands/shared";
import { hasWindow } from "@/lib/runtime-globals";

export type CategoryImportFile = ImportFileMetadata;

export const openCategoryImportFile = (): CommandResult<CategoryImportFile | null> => {
  if (!hasWindow()) {
    return Promise.resolve(
      Result.fail(new CommandError("Category import is only available in the client")),
    );
  }

  return Result.try({
    try: () =>
      selectCsvImportFile({
        title: "Import categories",
      }),
    catch: toCommandError,
  });
};
