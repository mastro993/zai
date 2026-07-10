import { Result } from "@praha/byethrow";

import { CommandError } from "../errors";
import { parseCommandBuildTarget } from "../build-target";
import { tauriDownloadTextFile } from "./tauri-download-text-file";
import type { DownloadTextFileOptions } from "./types";
import { webDownloadTextFile } from "./web-download-text-file";

export const downloadTextFile = async (
  options: DownloadTextFileOptions,
): Promise<string | null> => {
  const buildTargetResult = parseCommandBuildTarget(import.meta.env.VITE_ZAI_BUILD_TARGET);

  if (Result.isFailure(buildTargetResult)) {
    throw new CommandError(buildTargetResult.error.message);
  }

  if (buildTargetResult.value === "web") {
    return webDownloadTextFile(options);
  }

  return tauriDownloadTextFile(options);
};
