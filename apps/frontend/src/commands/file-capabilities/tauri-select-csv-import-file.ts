import type { ImportFileMetadata, SelectCsvImportFileOptions } from "./types";

const toFileName = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

export const tauriSelectCsvImportFile = async (
  options: SelectCsvImportFileOptions,
): Promise<ImportFileMetadata | null> => {
  const [{ open }, { readTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const selectedPath = await open({
    title: options.title,
    multiple: false,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  return {
    name: toFileName(selectedPath),
    content: await readTextFile(selectedPath),
  };
};
