import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { downloadTextFile } from "../download-text-file";
import { selectCsvImportFile } from "../select-csv-import-file";
import { tauriDownloadTextFile } from "../tauri-download-text-file";
import { tauriSelectCsvImportFile } from "../tauri-select-csv-import-file";
import { webDownloadTextFile } from "../web-download-text-file";
import { webSelectCsvImportFile } from "../web-select-csv-import-file";

vi.mock("../web-select-csv-import-file", () => ({
  webSelectCsvImportFile: vi.fn(),
}));

vi.mock("../tauri-select-csv-import-file", () => ({
  tauriSelectCsvImportFile: vi.fn(),
}));

vi.mock("../web-download-text-file", () => ({
  webDownloadTextFile: vi.fn(),
}));

vi.mock("../tauri-download-text-file", () => ({
  tauriDownloadTextFile: vi.fn(),
}));

const webSelectMock = vi.mocked(webSelectCsvImportFile);
const tauriSelectMock = vi.mocked(tauriSelectCsvImportFile);
const webDownloadMock = vi.mocked(webDownloadTextFile);
const tauriDownloadMock = vi.mocked(tauriDownloadTextFile);

describe("category file capability routing", () => {
  const originalBuildTarget = import.meta.env.VITE_ZAI_BUILD_TARGET;

  beforeEach(() => {
    webSelectMock.mockReset();
    tauriSelectMock.mockReset();
    webDownloadMock.mockReset();
    tauriDownloadMock.mockReset();
  });

  afterEach(() => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = originalBuildTarget;
  });

  it("routes category CSV import through the web adapter in web mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "web";
    webSelectMock.mockResolvedValue({ name: "categories.csv", content: "name" });

    const result = await selectCsvImportFile({ title: "Import categories" });

    expect(webSelectMock).toHaveBeenCalledWith({ title: "Import categories" });
    expect(tauriSelectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ name: "categories.csv", content: "name" });
  });

  it("routes category CSV import through the Tauri adapter in desktop mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "tauri";
    tauriSelectMock.mockResolvedValue({ name: "categories.csv", content: "name" });

    const result = await selectCsvImportFile({ title: "Import categories" });

    expect(tauriSelectMock).toHaveBeenCalledWith({ title: "Import categories" });
    expect(webSelectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ name: "categories.csv", content: "name" });
  });

  it("routes category CSV export through the web adapter in web mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "web";
    webDownloadMock.mockReturnValue("zai_transaction_categories_20260706_162830.csv");

    const result = await downloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(webDownloadMock).toHaveBeenCalled();
    expect(tauriDownloadMock).not.toHaveBeenCalled();
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("routes category CSV export through the Tauri adapter in desktop mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "tauri";
    tauriDownloadMock.mockResolvedValue("zai_transaction_categories_20260706_162830.csv");

    const result = await downloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(tauriDownloadMock).toHaveBeenCalled();
    expect(webDownloadMock).not.toHaveBeenCalled();
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("fails when the build target is missing", async () => {
    Reflect.deleteProperty(import.meta.env, "VITE_ZAI_BUILD_TARGET");

    await expect(selectCsvImportFile({ title: "Import categories" })).rejects.toMatchObject({
      message: "VITE_ZAI_BUILD_TARGET is required. Expected one of: tauri, web.",
    });
  });

  it("fails when the build target is unknown", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "native";

    const result = await Result.try({
      try: () => downloadTextFile({ title: "Export categories", filename: "x.csv", content: "" }),
      catch: (error) => error,
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toMatchObject({
      message: 'Unknown VITE_ZAI_BUILD_TARGET "native". Expected one of: tauri, web.',
    });
  });
});
