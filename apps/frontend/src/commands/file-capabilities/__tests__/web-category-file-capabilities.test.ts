// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { webDownloadTextFile } from "../web-download-text-file";
import { webSelectCsvImportFile } from "../web-select-csv-import-file";

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
    const click = vi.fn();
    const remove = vi.fn();
    const text = vi.fn().mockResolvedValue("name,parent_name\nFood,,");
    const input = {
      type: "file",
      accept: "",
      files: [{ name: "categories.csv", text }],
      addEventListener: vi.fn((event, listener) => {
        if (event === "change") {
          queueMicrotask(() => listener());
        }
      }),
      remove,
      click,
    };

    vi.spyOn(document, "createElement").mockReturnValue(input as unknown as HTMLInputElement);
    vi.spyOn(window, "addEventListener").mockImplementation(() => undefined);
    vi.spyOn(window, "removeEventListener").mockImplementation(() => undefined);

    const result = await webSelectCsvImportFile({ title: "Import categories" });

    expect(click).toHaveBeenCalled();
    expect(text).toHaveBeenCalled();
    expect(result).toEqual({
      name: "categories.csv",
      content: "name,parent_name\nFood,,",
    });
  });

  it("returns null when the browser file picker is canceled", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const input = {
      type: "file",
      accept: "",
      files: null,
      addEventListener: vi.fn((event, listener) => {
        if (event === "cancel") {
          queueMicrotask(() => listener());
        }
      }),
      remove,
      click,
    };

    vi.spyOn(document, "createElement").mockReturnValue(input as unknown as HTMLInputElement);
    vi.spyOn(window, "addEventListener").mockImplementation(() => undefined);
    vi.spyOn(window, "removeEventListener").mockImplementation(() => undefined);

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
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi
        .fn()
        .mockRejectedValue(new DOMException("The user aborted a request.", "AbortError")),
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
