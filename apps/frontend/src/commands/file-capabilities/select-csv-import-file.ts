import { Result } from "@praha/byethrow";

import { CommandError } from "../errors";
import { parseCommandBuildTarget } from "../build-target";
import { tauriSelectCsvImportFile } from "./tauri-select-csv-import-file";
import type { ImportFileMetadata, SelectCsvImportFileOptions } from "./types";
import { webSelectCsvImportFile } from "./web-select-csv-import-file";

export const selectCsvImportFile = async (
  options: SelectCsvImportFileOptions,
): Promise<ImportFileMetadata | null> => {
  const buildTargetResult = parseCommandBuildTarget(import.meta.env.VITE_ZAI_BUILD_TARGET);

  if (Result.isFailure(buildTargetResult)) {
    throw new CommandError(buildTargetResult.error.message);
  }

  if (buildTargetResult.value === "web") {
    return webSelectCsvImportFile(options);
  }

  return tauriSelectCsvImportFile(options);
};
