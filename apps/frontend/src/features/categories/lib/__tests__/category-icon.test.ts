import { describe, expect, it } from "vitest";

import {
  CATEGORY_ICON_CATALOG,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  parseCategoryIcon,
} from "../category-icon";
import { getCategoryDisplayIcon } from "../category";
import type { TransactionCategory } from "../../types/model";

const root = (overrides: Partial<TransactionCategory> = {}): TransactionCategory => ({
  id: "root",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C32828",
  role: "spending",
  parent: null,
  ...overrides,
});

describe("category icons", () => {
  it("curates 48 unique keys", () => {
    expect(CATEGORY_ICON_CATALOG).toHaveLength(48);
    expect(new Set(CATEGORY_ICONS).size).toBe(48);
  });

  it("parses known keys and drops unknown values", () => {
    expect(parseCategoryIcon("food")).toBe("food");
    expect(parseCategoryIcon("spaceship")).toBeNull();
    expect(parseCategoryIcon("")).toBeNull();
  });

  it("uses default for a root without a selected icon", () => {
    expect(getCategoryDisplayIcon(root())).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("lets a child inherit the root effective icon", () => {
    const parent = root({ icon: "dining" });
    const child: TransactionCategory = {
      id: "child",
      parentId: parent.id,
      name: "Groceries",
      description: null,
      color: null,
      role: "spending",
      parent,
    };

    expect(getCategoryDisplayIcon(child)).toBe("dining");
  });

  it("lets a child override the inherited icon, including the default symbol", () => {
    const parent = root({ icon: "dining" });
    const child: TransactionCategory = {
      id: "child",
      parentId: parent.id,
      name: "Groceries",
      description: null,
      color: null,
      icon: "default",
      role: "spending",
      parent,
    };

    expect(getCategoryDisplayIcon(child)).toBe("default");
  });
});
