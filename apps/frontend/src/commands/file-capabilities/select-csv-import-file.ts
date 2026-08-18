import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget } from "../build-target";
import { CommandError } from "../errors";
import { tauriSelectCsvImportFile } from "./tauri-select-csv-import-file";
import type { ImportFileMetadata, SelectCsvImportFileOptions } from "./types";
import { webSelectCsvImportFile } from "./web-select-csv-import-file";

export interface SelectCsvImportFileAdapters {
  web: typeof webSelectCsvImportFile;
  tauri: typeof tauriSelectCsvImportFile;
}

const defaultSelectCsvImportFileAdapters: SelectCsvImportFileAdapters = {
  web: webSelectCsvImportFile,
  tauri: tauriSelectCsvImportFile,
};

export const selectCsvImportFile = async (
  options: SelectCsvImportFileOptions,
  adapters: SelectCsvImportFileAdapters = defaultSelectCsvImportFileAdapters,
): Promise<ImportFileMetadata | null> => {
  const buildTargetResult = parseCommandBuildTarget(import.meta.env.VITE_ZAI_BUILD_TARGET);

  if (Result.isFailure(buildTargetResult)) {
    throw new CommandError(buildTargetResult.error.message);
  }

  if (buildTargetResult.value === "web") {
    return adapters.web(options);
  }

  return adapters.tauri(options);
};
