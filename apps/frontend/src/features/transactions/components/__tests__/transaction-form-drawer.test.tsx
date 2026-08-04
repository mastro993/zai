// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";

import { TransactionFormDrawer } from "../transaction-form-drawer";

afterEach(() => {
  cleanup();
});

describe("TransactionFormDrawer", () => {
  it("distinguishes expense and income with directional semantic icons", () => {
    render(
      <Drawer open swipeDirection="right">
        <TransactionFormDrawer
          mode={{ type: "create" }}
          categories={[]}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </Drawer>,
    );

    const typeGroup = screen.getByRole("group", { name: "Transaction type" });
    const expense = within(typeGroup).getByRole("button", { name: "expense" });
    const income = within(typeGroup).getByRole("button", { name: "income" });

    expect(expense.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(income.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(expense.querySelector("svg")?.classList.contains("text-destructive")).toBe(true);
    expect(income.querySelector("svg")?.classList.contains("text-primary")).toBe(true);
  });

  it("does not show redundant date helper text", () => {
    render(
      <Drawer open swipeDirection="right">
        <TransactionFormDrawer
          mode={{ type: "create" }}
          categories={[]}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </Drawer>,
    );

    expect(screen.queryByText("Date and time when the transaction occurred.")).toBeNull();
  });

  it("labels the transaction date field as date and time", () => {
    render(
      <Drawer open swipeDirection="right">
        <TransactionFormDrawer
          mode={{ type: "create" }}
          categories={[]}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </Drawer>,
    );

    expect(screen.getByText("Date and time")).toBeDefined();
  });
});
