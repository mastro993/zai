// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { webDownloadTextFile } from "../web-download-text-file";
import { webSelectCsvImportFile } from "../web-select-csv-import-file";

const stubFileInput = (file: File | null, eventName: "change" | "cancel") => {
  const input = document.createElement("input");
  expect(input).toBeInstanceOf(HTMLInputElement);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  if (file !== null) {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
  }

  vi.spyOn(input, "click").mockImplementation(() => {
    input.dispatchEvent(new Event(eventName));
  });
  vi.spyOn(document, "createElement").mockReturnValue(input);
  vi.spyOn(window, "addEventListener").mockImplementation(() => undefined);
  vi.spyOn(window, "removeEventListener").mockImplementation(() => undefined);
};

describe("web category file capabilities", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:categories"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads selected CSV content through File.text()", async () => {
    stubFileInput(
      new File(["name,parent_name\nFood,,"], "categories.csv", { type: "text/csv" }),
      "change",
    );

    const result = await webSelectCsvImportFile({ title: "Import categories" });

    expect(result).toEqual({
      name: "categories.csv",
      content: "name,parent_name\nFood,,",
    });
  });

  it("returns null when the browser file picker is canceled", async () => {
    stubFileInput(null, "cancel");

    const result = await webSelectCsvImportFile({ title: "Import categories" });

    expect(result).toBeNull();
  });

  it("waits for the save file picker before reporting export success", async () => {
    let resolvePicker:
      | ((handle: {
          name: string;
          createWritable: () => Promise<{
            write: (data: string) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }) => void)
      | undefined;
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const showSaveFilePicker = vi.fn(
      () =>
        new Promise<Parameters<NonNullable<typeof resolvePicker>>[0]>((resolve) => {
          resolvePicker = resolve;
        }),
    );

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: showSaveFilePicker,
    });

    const exportPromise = webDownloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(showSaveFilePicker).toHaveBeenCalled();
    await Promise.resolve();
    let settled = false;
    void exportPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolvePicker?.({
      name: "zai_transaction_categories_20260706_162830.csv",
      createWritable: async () => ({ write, close }),
    });

    await expect(exportPromise).resolves.toBe("zai_transaction_categories_20260706_162830.csv");
    expect(write).toHaveBeenCalledWith("name,parent_name,color,description");
    expect(close).toHaveBeenCalled();
  });

  it("returns null when the save file picker is canceled", async () => {
    const abortError = new Error("The user aborted a request.");
    abortError.name = "AbortError";
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn().mockRejectedValue(abortError),
    });

    const filename = await webDownloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(filename).toBeNull();
  });

  it("falls back to anchor download when save file picker is unavailable", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: undefined,
    });

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const filename = await webDownloadTextFile({
      title: "Export categories",
      filename: "zai_transaction_categories_20260706_162830.csv",
      content: "name,parent_name,color,description",
    });

    expect(filename).toBe("zai_transaction_categories_20260706_162830.csv");
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:categories");
  });
});
