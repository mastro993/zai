// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";

import { categorySchema } from "../../types/model";
import { CategoryFormDrawer } from "../category-form-drawer";

const food = categorySchema.parse({
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
  color: "#C32828",
});

const salary = categorySchema.parse({
  id: "salary",
  parentId: null,
  name: "Salary",
  role: "income",
  color: "#28C34E",
});

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

  it("uses a searchable combobox for the parent category", () => {
    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-root" }}
          categories={[food, salary]}
          onSubmit={vi.fn()}
        />
      </Drawer>,
    );

    const trigger = screen.getByRole("combobox", { name: "Parent category" });
    expect(trigger.textContent).toContain("None");

    fireEvent.click(trigger);

    const search = screen.getByPlaceholderText("Search categories");
    fireEvent.change(search, { target: { value: "food" } });

    const foodOption = screen.getByRole("option", { name: "Food" });
    expect(foodOption.querySelector('[data-slot="badge"]')).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Salary" })).toBeNull();

    fireEvent.click(foodOption);
    expect(trigger.textContent).toContain("Food");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByPlaceholderText("Search categories")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "None" }));
    expect(screen.getByRole("combobox", { name: "Category role" })).not.toBeNull();
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
    expect(trigger.textContent).toContain("Spending");

    fireEvent.click(trigger);

    const popup = screen.getByRole("dialog", { name: "Select category role" });
    expect(popup.getAttribute("aria-label")).toBe("Select category role");

    const spending = screen.getByRole("option", { name: /Spending/ });
    const income = screen.getByRole("option", { name: /Income/ });
    expect(spending.textContent).toContain("Tracks outflows and can include refunds.");
    expect(income.textContent).toContain("Identifies genuine income only.");
    expect(spending.classList.contains("border-primary/30")).toBe(true);
    expect(spending.classList.contains("bg-primary/5")).toBe(true);
    expect(income.classList.contains("border-primary/30")).toBe(false);
    expect(income.classList.contains("bg-primary/5")).toBe(false);

    const spendingIcon = spending.querySelector('[data-slot="category-role-icon"]');
    const incomeIcon = income.querySelector('[data-slot="category-role-icon"]');
    expect(spendingIcon?.classList.contains("border-primary/30")).toBe(true);
    expect(spendingIcon?.classList.contains("bg-primary/10")).toBe(true);
    expect(spendingIcon?.classList.contains("text-primary")).toBe(true);
    expect(incomeIcon?.classList.contains("border-border")).toBe(true);
    expect(incomeIcon?.classList.contains("bg-muted/40")).toBe(true);
    expect(incomeIcon?.classList.contains("text-muted-foreground")).toBe(true);

    expect(spending.classList.contains("[&>span[data-selected]]:top-1/2")).toBe(true);
    expect(spending.classList.contains("[&>span[data-selected]]:-translate-y-1/2")).toBe(true);
    expect(spending.classList.contains("[&>span[data-selected]]:text-primary")).toBe(true);

    fireEvent.click(income);
    expect(trigger.textContent).toContain("Income");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("option", { name: /Income/ })).toBeNull();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const keyboardPopup = screen.getByRole("dialog", { name: "Select category role" });
    expect(keyboardPopup.getAttribute("aria-label")).toBe("Select category role");

    const reopenedSpending = screen.getByRole("option", { name: /Spending/ });
    const reopenedIncome = screen.getByRole("option", { name: /Income/ });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(reopenedSpending.classList.contains("border-primary/30")).toBe(false);
    expect(reopenedIncome.classList.contains("border-primary/30")).toBe(true);
    expect(reopenedIncome.classList.contains("bg-primary/5")).toBe(true);

    fireEvent.click(reopenedIncome);
    expect(trigger.textContent).toContain("Income");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Salary" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ role: "income" })),
    );
  });

  it("selects a category icon from the curated grid", async () => {
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

    const iconTrigger = screen.getByRole("button", { name: "Category icon, Default" });
    expect(iconTrigger.querySelector("svg")?.getAttribute("style")).toBeNull();

    fireEvent.click(iconTrigger);
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Meals" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ icon: "food" })),
    );
  });

  it("lets a child inherit the parent icon", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Category icon, Default" }));
    expect(screen.getByRole("button", { name: "Inherit from parent" })).not.toBeNull();
  });
});
