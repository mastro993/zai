import type { DownloadTextFileOptions } from "./types";

const appendPath = (directory: string, filename: string) => {
  if (directory.endsWith("/") || directory.endsWith("\\")) {
    return `${directory}${filename}`;
  }

  return `${directory}${directory.includes("\\") ? "\\" : "/"}${filename}`;
};

const toFileName = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

export const tauriDownloadTextFile = async (
  options: DownloadTextFileOptions,
): Promise<string | null> => {
  const [{ save }, { writeTextFile }, { documentDir }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/api/path"),
  ]);
  const outputPath = await save({
    title: options.title,
    defaultPath: options.defaultPath ?? appendPath(await documentDir(), options.filename),
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!outputPath) {
    return null;
  }

  await writeTextFile(outputPath, options.content);

  return toFileName(outputPath);
};
