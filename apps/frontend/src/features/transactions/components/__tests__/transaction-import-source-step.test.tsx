// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionImportSourceStep } from "../transaction-import-source-step";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

describe("TransactionImportSourceStep", () => {
  it("displays browser-safe file metadata without a desktop path", () => {
    render(
      <TransactionImportSourceStep
        file={{
          name: "transactions.csv",
          content: "date,description,amount\n2026-01-01,Coffee,-3.50",
        }}
        rowCount={1}
        isPickingFile={false}
        onSelectFile={() => undefined}
      />,
    );

    expect(screen.getByText("transactions.csv")).toBeTruthy();
    expect(screen.queryByText(/Users\//)).toBeNull();
    expect(screen.queryByText(/C:\\/)).toBeNull();
    expect(screen.getByText("1 row")).toBeTruthy();
  });
});
