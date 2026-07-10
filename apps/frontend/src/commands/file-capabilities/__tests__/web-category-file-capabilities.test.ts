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

  it("downloads category CSV content with the requested filename", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const filename = webDownloadTextFile({
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
