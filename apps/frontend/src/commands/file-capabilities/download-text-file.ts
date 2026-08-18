import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget } from "../build-target";
import { CommandError } from "../errors";
import { tauriDownloadTextFile } from "./tauri-download-text-file";
import type { DownloadTextFileOptions } from "./types";
import { webDownloadTextFile } from "./web-download-text-file";

export interface DownloadTextFileAdapters {
  web: typeof webDownloadTextFile;
  tauri: typeof tauriDownloadTextFile;
}

const defaultDownloadTextFileAdapters: DownloadTextFileAdapters = {
  web: webDownloadTextFile,
  tauri: tauriDownloadTextFile,
};

export const downloadTextFile = async (
  options: DownloadTextFileOptions,
  adapters: DownloadTextFileAdapters = defaultDownloadTextFileAdapters,
): Promise<string | null> => {
  const buildTargetResult = parseCommandBuildTarget(import.meta.env.VITE_ZAI_BUILD_TARGET);

  if (Result.isFailure(buildTargetResult)) {
    throw new CommandError(buildTargetResult.error.message);
  }

  if (buildTargetResult.value === "web") {
    return adapters.web(options);
  }

  return adapters.tauri(options);
};
