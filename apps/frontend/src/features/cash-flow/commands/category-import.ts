import { Result } from "@praha/byethrow";

import { CommandError, type CommandResult, toCommandError } from "@/commands/shared";

export type CategoryImportFile = {
  path: string;
  content: string;
};

export const openCategoryImportFile = (): CommandResult<CategoryImportFile | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      Result.fail(new CommandError("Category import is only available in the desktop app")),
    );
  }

  return Result.try({
    try: async () => {
      const [{ open }, { readTextFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const selectedPath = await open({
        title: "Import categories",
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return null;
      }

      return {
        path: selectedPath,
        content: await readTextFile(selectedPath),
      };
    },
    catch: toCommandError,
  });
};
