import { R } from "@praha/byethrow";

import type { CommandResult } from "@/commands/shared";

export type CategoryImportFile = {
  path: string;
  content: string;
};

const toImportError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export const openCategoryImportFile = (): CommandResult<CategoryImportFile | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      R.fail(new Error("Category import is only available in the desktop app")),
    );
  }

  return R.try({
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
    catch: toImportError,
  });
};
