import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "../download-text-file";
import { selectCsvImportFile } from "../select-csv-import-file";
import { tauriDownloadTextFile } from "../tauri-download-text-file";
import { tauriSelectCsvImportFile } from "../tauri-select-csv-import-file";

describe("tauri category file capabilities", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes desktop CSV import through the injected tauri adapter", async () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
    const tauri = vi.fn().mockResolvedValue({
      name: "categories.csv",
      content: "name,parent_name\nFood,,",
    });
    const web = vi.fn();

    const result = await selectCsvImportFile({ title: "Import categories" }, { web, tauri });

    expect(web).not.toHaveBeenCalled();
    expect(tauri).toHaveBeenCalledWith({ title: "Import categories" });
    expect(result).toEqual({
      name: "categories.csv",
      content: "name,parent_name\nFood,,",
    });
  });

  it("routes desktop CSV export through the injected tauri adapter", async () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
    const tauri = vi.fn().mockResolvedValue("zai_transaction_categories_20260706_162830.csv");
    const web = vi.fn();

    const result = await downloadTextFile(
      {
        title: "Export categories",
        filename: "zai_transaction_categories_20260706_162830.csv",
        content: "name,parent_name,color,description",
      },
      { web, tauri },
    );

    expect(web).not.toHaveBeenCalled();
    expect(tauri).toHaveBeenCalledWith({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("fails closed when native import APIs are unavailable", async () => {
    await expect(tauriSelectCsvImportFile({ title: "Import categories" })).rejects.toBeTruthy();
  });

  it("fails closed when native export APIs are unavailable", async () => {
    await expect(
      tauriDownloadTextFile({
        title: "Export categories",
        filename: "zai_transaction_categories_20260706_162830.csv",
        content: "name,parent_name,color,description",
      }),
    ).rejects.toBeTruthy();
  });
});
