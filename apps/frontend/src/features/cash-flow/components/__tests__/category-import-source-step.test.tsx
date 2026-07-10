// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryImportSourceStep } from "../category-import-source-step";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

describe("CategoryImportSourceStep", () => {
  it("displays browser-safe file metadata without a desktop path", () => {
    render(
      <CategoryImportSourceStep
        file={{ name: "categories.csv", content: "name,parent_name\nFood,," }}
        rowCount={2}
        isPickingFile={false}
        onSelectFile={() => undefined}
      />,
    );

    expect(screen.getByText("categories.csv")).toBeTruthy();
    expect(screen.queryByText(/Users\//)).toBeNull();
    expect(screen.queryByText(/C:\\/)).toBeNull();
    expect(screen.getByText("2 rows")).toBeTruthy();
  });
});
