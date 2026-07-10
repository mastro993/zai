import type { ImportFileMetadata, SelectCsvImportFileOptions } from "./types";

export const webSelectCsvImportFile = (
  _options: SelectCsvImportFileOptions,
): Promise<ImportFileMetadata | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";

    let settled = false;
    const finish = (value: ImportFileMetadata | null) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);
    };

    const cleanup = () => {
      input.remove();
      window.removeEventListener("focus", onWindowFocus);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          finish(null);
        }
      }, 300);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }

      void file.text().then((content) => {
        finish({ name: file.name, content });
      });
    });

    input.addEventListener("cancel", () => {
      finish(null);
    });

    window.addEventListener("focus", onWindowFocus, { once: true });
    input.click();
  });
