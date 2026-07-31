// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as Hugeicons from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/screen-base", () => ({
  ScreenBase: ({ actions, children }: { actions?: ReactNode; children?: ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@hugeicons/core-free-icons", async (importOriginal) => ({
  ...(await importOriginal<typeof Hugeicons>()),
  DownloadIcon: "download",
  FileExportIcon: "file-export",
  FileImportIcon: "file-import",
  UploadIcon: "upload",
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ icon }: { icon: unknown }) => (
    <span aria-hidden="true" data-icon-name={String(icon)} />
  ),
}));

import { CategoryScreen } from "../category-screen";

describe("CategoryScreen actions", () => {
  afterEach(() => cleanup());

  it("groups upload and download actions with tooltips", async () => {
    render(
      <CategoryScreen
        initialCategories={[
          {
            id: "food",
            parentId: null,
            name: "Food",
            description: null,
            color: "#C55B26",
            role: "spending",
            parent: null,
          },
        ]}
      />,
    );

    const importAction = screen.getByRole("button", { name: "Import categories" });
    const exportAction = screen.getByRole("button", { name: "Export categories" });
    const actionGroup = importAction.closest('[data-slot="button-group"]');

    expect(importAction.textContent).toBe("");
    expect(exportAction.textContent).toBe("");
    expect(actionGroup?.getAttribute("aria-label")).toBe("Category file actions");
    expect(actionGroup?.contains(exportAction)).toBe(true);
    expect(importAction.querySelector('[data-icon-name="upload"]')).not.toBeNull();
    expect(exportAction.querySelector('[data-icon-name="download"]')).not.toBeNull();
    expect(importAction.classList.contains("size-7")).toBe(true);
    expect(exportAction.classList.contains("size-7")).toBe(true);

    fireEvent.focus(importAction);
    await waitFor(() => expect(screen.getByText("Import categories")).not.toBeNull());

    fireEvent.blur(importAction);
    fireEvent.focus(exportAction);
    await waitFor(() => expect(screen.getByText("Export categories")).not.toBeNull());
  });

  it("renders the empty state with one primary create action and import fallback", () => {
    render(<CategoryScreen initialCategories={[]} />);

    const emptyState = screen.getByRole("region", { name: "Set up your categories" });

    expect(emptyState).not.toBeNull();
    expect(emptyState.classList.contains("rounded-lg")).toBe(true);
    expect(screen.getByRole("heading", { name: "Set up your categories" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "New category" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Import categories" })).toHaveLength(2);
  });

  it("keeps the header new category action when categories exist", () => {
    render(
      <CategoryScreen
        initialCategories={[
          {
            id: "food",
            parentId: null,
            name: "Food",
            description: null,
            color: "#C55B26",
            role: "spending",
            parent: null,
          },
        ]}
      />,
    );

    const newCategoryAction = screen.getByRole("button", { name: "New category" });

    expect(newCategoryAction.classList.contains("h-7")).toBe(true);
    expect(screen.queryByRole("region", { name: "Set up your categories" })).toBeNull();
  });
});
