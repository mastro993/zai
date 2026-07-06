import { R } from "@praha/byethrow";

import type { CommandResult } from "@/commands/shared";

import { getCategoryExportFilename, toCategoryExportCsv } from "../lib/category-export";
import type { TransactionCategory } from "../types/model";

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

export const exportCategories = (
  categories: Array<TransactionCategory>,
): CommandResult<string | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      R.fail(new Error("Category export is only available in the desktop app")),
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
        title: "Export categories",
        defaultPath: appendPath(await documentDir(), getCategoryExportFilename()),
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (!outputPath) {
        return null;
      }

      await writeTextFile(outputPath, toCategoryExportCsv(categories));

      return outputPath;
    },
    catch: toExportError,
  });
};
