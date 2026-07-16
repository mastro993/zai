import type { DownloadTextFileOptions } from "./types";

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, Array<string>>;
    }>;
  }) => Promise<{
    name: string;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

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

export const webDownloadTextFile = async (
  options: DownloadTextFileOptions,
): Promise<string | null> => {
  const showSaveFilePicker = (window as SaveFilePickerWindow).showSaveFilePicker;

  if (typeof showSaveFilePicker !== "function") {
    return downloadViaAnchor(options);
  }

  try {
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
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }

    throw error;
  }
};
