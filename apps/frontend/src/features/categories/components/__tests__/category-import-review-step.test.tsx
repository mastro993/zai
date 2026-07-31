// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryImportPreview } from "../../lib/category-import";
import { CategoryImportReviewStep } from "../category-import-review-step";

const preview: CategoryImportPreview = {
  headers: ["name", "color"],
  rows: [
    {
      rowNumber: 2,
      parentName: "",
      name: "Broken",
      color: "red",
      description: "",
      status: "warning",
      message: "Color ignored; category imports without color.",
    },
    {
      rowNumber: 3,
      parentName: "",
      name: "Food",
      color: "#C55B26",
      description: "",
      status: "import",
      message: "Ready to import",
    },
  ],
  categories: [],
  summary: {
    totalRows: 2,
    importableRows: 2,
    warningRows: 1,
    duplicateRows: 0,
    invalidRows: 0,
    emptyRows: 0,
    autoCreatedParents: 0,
    categoriesToCreate: 2,
  },
};

describe("CategoryImportReviewStep", () => {
  it("keeps warning rows importable and shows warning details", () => {
    render(
      <CategoryImportReviewStep
        preview={preview}
        previewFilter="importable"
        onPreviewFilterChange={() => undefined}
      />,
    );

    expect(screen.getByText("Warning")).toBeTruthy();
    expect(screen.getByText("Color ignored; category imports without color.")).toBeTruthy();
    expect(screen.getByText("2 of 2 rows")).toBeTruthy();
    expect(screen.getByText("Warnings").parentElement?.textContent).toBe("Warnings1");
  });
});
