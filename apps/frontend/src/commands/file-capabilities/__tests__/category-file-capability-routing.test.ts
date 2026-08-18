import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { downloadTextFile } from "../download-text-file";
import { selectCsvImportFile } from "../select-csv-import-file";

const webSelectMock = vi.fn();
const tauriSelectMock = vi.fn();
const webDownloadMock = vi.fn();
const tauriDownloadMock = vi.fn();

const selectAdapters = { web: webSelectMock, tauri: tauriSelectMock };
const downloadAdapters = { web: webDownloadMock, tauri: tauriDownloadMock };

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

    const result = await selectCsvImportFile({ title: "Import categories" }, selectAdapters);

    expect(webSelectMock).toHaveBeenCalledWith({ title: "Import categories" });
    expect(tauriSelectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ name: "categories.csv", content: "name" });
  });

  it("routes category CSV import through the Tauri adapter in desktop mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "tauri";
    tauriSelectMock.mockResolvedValue({ name: "categories.csv", content: "name" });

    const result = await selectCsvImportFile({ title: "Import categories" }, selectAdapters);

    expect(tauriSelectMock).toHaveBeenCalledWith({ title: "Import categories" });
    expect(webSelectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ name: "categories.csv", content: "name" });
  });

  it("routes category CSV export through the web adapter in web mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "web";
    webDownloadMock.mockResolvedValue("zai_transaction_categories_20260706_162830.csv");

    const result = await downloadTextFile(
      {
        title: "Export categories",
        filename: "zai_transaction_categories_20260706_162830.csv",
        content: "name,parent_name,color,description",
      },
      downloadAdapters,
    );

    expect(webDownloadMock).toHaveBeenCalled();
    expect(tauriDownloadMock).not.toHaveBeenCalled();
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("routes category CSV export through the Tauri adapter in desktop mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "tauri";
    tauriDownloadMock.mockResolvedValue("zai_transaction_categories_20260706_162830.csv");

    const result = await downloadTextFile(
      {
        title: "Export categories",
        filename: "zai_transaction_categories_20260706_162830.csv",
        content: "name,parent_name,color,description",
      },
      downloadAdapters,
    );

    expect(tauriDownloadMock).toHaveBeenCalled();
    expect(webDownloadMock).not.toHaveBeenCalled();
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("routes transaction CSV import through the web adapter in web mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "web";
    webSelectMock.mockResolvedValue({ name: "transactions.csv", content: "date,amount" });

    const result = await selectCsvImportFile({ title: "Import transactions" }, selectAdapters);

    expect(webSelectMock).toHaveBeenCalledWith({ title: "Import transactions" });
    expect(tauriSelectMock).not.toHaveBeenCalled();
    expect(result).toEqual({ name: "transactions.csv", content: "date,amount" });
  });

  it("routes transaction CSV export through the Tauri adapter in desktop mode", async () => {
    import.meta.env.VITE_ZAI_BUILD_TARGET = "tauri";
    tauriDownloadMock.mockResolvedValue("zai_transactions_20260710_112700.csv");

    const result = await downloadTextFile(
      {
        title: "Export transactions",
        filename: "zai_transactions_20260710_112700.csv",
        content: "date,amount,type,description",
      },
      downloadAdapters,
    );

    expect(tauriDownloadMock).toHaveBeenCalled();
    expect(webDownloadMock).not.toHaveBeenCalled();
    expect(result).toBe("zai_transactions_20260710_112700.csv");
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
      catch: (cause) => cause,
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
