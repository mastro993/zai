import { describe, expect, it } from "vitest";

import { toCategoryExportCsv } from "../category-export";
import {
  buildCategoryImportPreview,
  getDefaultCategoryImportMapping,
  parseCategoryCsv,
  type CategoryImportPreviewOptions,
} from "../category-import";
import type { TransactionCategory } from "../../types/model";

const makeIdFactory = () => {
  let nextId = 1;

  return () => `id-${nextId++}`;
};

const buildPreview = (content: string, options: Partial<CategoryImportPreviewOptions> = {}) => {
  const headers = parseCategoryCsv(content)[options.headerRowIndex ?? 0] ?? [];

  return buildCategoryImportPreview(content, {
    headerRowIndex: 0,
    mapping: getDefaultCategoryImportMapping(headers),
    linkMode: "columns",
    separator: " - ",
    existingCategories: [],
    createId: makeIdFactory(),
    ...options,
  });
};

describe("category import", () => {
  it("round-trips exported CSV with quoted commas and newlines", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: 'Food, "Home"',
      description: "Monthly\nneeds",
      color: "#C92A2A",
      parent: null,
    };
    const child: TransactionCategory = {
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: null,
      parent: root,
    };

    const preview = buildPreview(toCategoryExportCsv([root, child]));

    expect(preview.categories).toEqual([
      {
        id: "id-1",
        parentId: null,
        name: 'Food, "Home"',
        description: "Monthly\nneeds",
        color: "#C92A2A",
      },
      {
        id: "id-2",
        parentId: "id-1",
        name: "Groceries",
        description: null,
        color: null,
      },
    ]);
  });

  it("uses the selected header row and auto-creates missing parents", () => {
    const content = ["skip me", "name,parent_name", "Groceries,Food"].join("\n");
    const headers = parseCategoryCsv(content)[1] ?? [];
    const preview = buildPreview(content, {
      headerRowIndex: 1,
      mapping: getDefaultCategoryImportMapping(headers),
    });

    expect(preview.summary.autoCreatedParents).toBe(1);
    expect(preview.categories.map((category) => category.name)).toEqual(["Food", "Groceries"]);
  });

  it("splits single-column paths on the first separator", () => {
    const preview = buildPreview("path\nFood - Restaurants - Pizza", {
      mapping: { name: 0, parentName: null, color: null, description: null },
      linkMode: "single-column",
      separator: " - ",
    });

    expect(preview.rows[0]).toMatchObject({
      parentName: "Food",
      name: "Restaurants - Pizza",
      status: "import",
    });
  });

  it("skips invalid rows and duplicate category paths from the import payload", () => {
    const existingRoot: TransactionCategory = {
      id: "existing-food",
      parentId: null,
      name: "Food",
      description: "Existing wins",
      color: "#C92A2A",
      parent: null,
    };
    const content = [
      "name,parent_name,color",
      "Food,,#FFFFFF",
      "Broken,,red",
      "Groceries,Food,#123456",
      "Restaurants,Food,",
    ].join("\n");

    const preview = buildPreview(content, {
      existingCategories: [existingRoot],
    });

    expect(preview.summary).toMatchObject({
      duplicateRows: 1,
      invalidRows: 1,
      categoriesToCreate: 2,
    });
    expect(preview.categories).toEqual([
      {
        id: "id-1",
        parentId: "existing-food",
        name: "Groceries",
        description: null,
        color: null,
      },
      {
        id: "id-2",
        parentId: "existing-food",
        name: "Restaurants",
        description: null,
        color: null,
      },
    ]);
  });
});
