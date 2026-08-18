import { Result } from "@praha/byethrow";

import { toCommandError } from "../errors";
import type { DownloadTextFileOptions } from "./types";

interface SaveFilePickerHandle {
  name: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: { readonly [mimeType: string]: ReadonlyArray<string> };
  }>;
}

const downloadViaAnchor = (options: DownloadTextFileOptions): string => {
  const blob = new Blob([options.content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return options.filename;
};

const isAbortError = (cause: unknown): boolean =>
  cause instanceof DOMException
    ? cause.name === "AbortError"
    : cause instanceof Error && cause.name === "AbortError";

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
}

const pickerFromWindow = (
  target: Window,
): ((options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>) | undefined => {
  const pickerWindow: SaveFilePickerWindow = target;
  const picker = pickerWindow.showSaveFilePicker;
  if (picker === undefined) {
    return undefined;
  }
  return (options: SaveFilePickerOptions) => picker(options);
};

export const webDownloadTextFile = async (
  options: DownloadTextFileOptions,
): Promise<string | null> => {
  const showSaveFilePicker = pickerFromWindow(window);

  if (showSaveFilePicker === undefined) {
    return downloadViaAnchor(options);
  }

  const result = await Result.try({
    try: async () => {
      const handle = await showSaveFilePicker({
        suggestedName: options.filename,
        types: [
          {
            description: "CSV",
            accept: { "text/csv": [".csv"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(options.content);
      await writable.close();
      return handle.name || options.filename;
    },
    catch: toCommandError,
  });

  if (Result.isSuccess(result)) {
    return result.value;
  }
  if (isAbortError(result.error.cause) || isAbortError(result.error)) {
    return null;
  }
  return Promise.reject(result.error);
};
