import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tauriDownloadTextFile } from "../tauri-download-text-file";
import { tauriSelectCsvImportFile } from "../tauri-select-csv-import-file";

const openMock = vi.hoisted(() => vi.fn());
const saveMock = vi.hoisted(() => vi.fn());
const readTextFileMock = vi.hoisted(() => vi.fn());
const writeTextFileMock = vi.hoisted(() => vi.fn());
const documentDirMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
  save: saveMock,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: readTextFileMock,
  writeTextFile: writeTextFileMock,
}));

vi.mock("@tauri-apps/api/path", () => ({
  documentDir: documentDirMock,
}));

describe("tauri category file capabilities", () => {
  beforeEach(() => {
    openMock.mockReset();
    saveMock.mockReset();
    readTextFileMock.mockReset();
    writeTextFileMock.mockReset();
    documentDirMock.mockReset();
    documentDirMock.mockResolvedValue("/Users/me/Documents");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps the Tauri dialog and filesystem APIs for CSV import", async () => {
    openMock.mockResolvedValue("/Users/me/Documents/categories.csv");
    readTextFileMock.mockResolvedValue("name,parent_name\nFood,,");

    const result = await tauriSelectCsvImportFile({ title: "Import categories" });

    expect(openMock).toHaveBeenCalledWith({
      title: "Import categories",
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    expect(readTextFileMock).toHaveBeenCalledWith("/Users/me/Documents/categories.csv");
    expect(result).toEqual({
      name: "categories.csv",
      content: "name,parent_name\nFood,,",
    });
  });

  it("returns null when the desktop file picker is canceled", async () => {
    openMock.mockResolvedValue(null);

    const result = await tauriSelectCsvImportFile({ title: "Import categories" });

    expect(result).toBeNull();
    expect(readTextFileMock).not.toHaveBeenCalled();
  });

  it("writes category CSV content through the desktop save dialog", async () => {
    saveMock.mockResolvedValue(
      "/Users/me/Documents/zai_transaction_categories_20260706_162830.csv",
    );
    writeTextFileMock.mockResolvedValue(undefined);

    const result = await tauriDownloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(documentDirMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledWith({
      title: "Export categories",
      defaultPath: "/Users/me/Documents/zai_transaction_categories_20260706_162830.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    expect(writeTextFileMock).toHaveBeenCalledWith(
      "/Users/me/Documents/zai_transaction_categories_20260706_162830.csv",
      "name,parent_name,color,description",
    );
    expect(result).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("returns null when the desktop save dialog is canceled", async () => {
    saveMock.mockResolvedValue(null);

    const result = await tauriDownloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(result).toBeNull();
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });
});
