import { describe, expect, it } from "vitest";

import { filterImportPreviewRows, getImportPreviewEmptyMessage } from "../import-preview-filter";

describe("import preview filter", () => {
  const rows = [
    { status: "import", id: 1 },
    { status: "invalid", id: 2 },
    { status: "duplicate", id: 3 },
    { status: "empty", id: 4 },
  ];

  it("filters importable rows only", () => {
    expect(filterImportPreviewRows(rows, "importable")).toEqual([{ status: "import", id: 1 }]);
  });

  it("filters skipped rows only", () => {
    expect(filterImportPreviewRows(rows, "skipped")).toEqual([
      { status: "invalid", id: 2 },
      { status: "duplicate", id: 3 },
      { status: "empty", id: 4 },
    ]);
  });

  it("returns all rows", () => {
    expect(filterImportPreviewRows(rows, "all")).toEqual(rows);
  });

  it("returns filter-specific empty messages", () => {
    expect(getImportPreviewEmptyMessage("skipped")).toContain("No skipped rows");
    expect(getImportPreviewEmptyMessage("importable")).toContain("No importable rows");
  });
});
