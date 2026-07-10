import type { DownloadTextFileOptions } from "./types";

export const webDownloadTextFile = (options: DownloadTextFileOptions): string => {
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
