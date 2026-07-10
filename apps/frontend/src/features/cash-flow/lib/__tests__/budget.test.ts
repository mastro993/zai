import { describe, expect, it } from "vitest";

import { suggestBudgetName } from "../budget";
import type { TransactionCategory } from "../../types/model";

const categories: Array<TransactionCategory> = [
  {
    id: "root-food",
    parentId: null,
    name: "Food",
    description: null,
    color: "#951818",
  },
  {
    id: "child-groceries",
    parentId: "root-food",
    name: "Groceries",
    description: null,
    color: null,
  },
];

describe("suggestBudgetName", () => {
  it("joins selected category labels", () => {
    expect(suggestBudgetName(categories, ["root-food", "child-groceries"])).toBe(
      "Food, Food / Groceries",
    );
  });
});
