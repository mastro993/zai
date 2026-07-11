import { describe, expect, it } from "vitest";

import { getCategoryExportFilename, toCategoryExportCsv } from "../category-export";
import type { TransactionCategory } from "../../types/model";

describe("category export", () => {
  it("formats the default filename with a compact local timestamp", () => {
    const filename = getCategoryExportFilename(new Date(2026, 6, 6, 16, 28, 30));

    expect(filename).toBe("zai_transaction_categories_20260706_162830.csv");
  });

  it("exports categories in input order with parent names and blank child colors", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: 'Food, "Home"',
      description: "Monthly\nneeds",
      color: "#C92A2A",
      role: "spending",
      parent: null,
    };
    const child: TransactionCategory = {
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: "#B95F00",
      role: "spending",
      parent: root,
    };

    const csv = toCategoryExportCsv([root, child]);

    expect(csv).toBe(
      [
        "name,parent_name,color,description",
        '"Food, ""Home""",,#C92A2A,"Monthly\nneeds"',
        'Groceries,"Food, ""Home""",,',
      ].join("\n"),
    );
  });
});
