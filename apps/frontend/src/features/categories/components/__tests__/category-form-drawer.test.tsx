// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";

import type { TransactionCategory } from "../../types/model";
import { CategoryFormDrawer } from "../category-form-drawer";

const food = {
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
} as TransactionCategory;

describe("CategoryFormDrawer", () => {
  afterEach(() => cleanup());

  it("does not render a separate list preview", () => {
    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-root" }}
          categories={[]}
          onSubmit={vi.fn()}
        />
      </Drawer>,
    );

    expect(screen.queryByText("List preview")).toBeNull();
    expect(screen.queryByRole("button", { name: "Parent category" })).toBeNull();
  });

  it("submits the selected root color", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-root" }}
          categories={[]}
          onSubmit={onSubmit}
        />
      </Drawer>,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ color: "#C32828" })),
    );
  });

  it("rounds the read-only role field for child categories", () => {
    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-child", parentId: food.id }}
          categories={[food]}
          onSubmit={vi.fn()}
        />
      </Drawer>,
    );

    const roleValue = screen.getByText("Spending");

    expect(roleValue.classList.contains("rounded-lg")).toBe(true);
  });

  it("uses a rich combobox for the root category role", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-root" }}
          categories={[]}
          onSubmit={onSubmit}
        />
      </Drawer>,
    );

    const trigger = screen.getByRole("combobox", { name: "Category role" });
    expect(trigger).toHaveTextContent("Spending");

    fireEvent.click(trigger);

    const spending = screen.getByRole("option", { name: /Spending/ });
    const income = screen.getByRole("option", { name: /Income/ });
    expect(spending).toHaveTextContent("Tracks outflows and can include refunds.");
    expect(income).toHaveTextContent("Identifies genuine income only.");
    expect(spending.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(income.querySelector('[aria-hidden="true"]')).not.toBeNull();

    fireEvent.click(income);
    expect(trigger).toHaveTextContent("Income");
    expect(screen.queryByRole("option", { name: /Income/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Salary" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: "income" })),
    );
  });
});
