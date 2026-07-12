import { describe, expect, it } from "vitest";

import { buildWebRequestSpec } from "../web-command-map";

describe("budget web command map", () => {
  it("maps list and detail reads", () => {
    expect(buildWebRequestSpec("get_budgets")).toEqual({
      method: "GET",
      path: "/budgets",
    });
    expect(buildWebRequestSpec("get_budget", { budgetId: "budget-1" })).toEqual({
      method: "GET",
      path: "/budgets/budget-1",
    });
  });

  it("maps budget creation without changing payload", () => {
    const newBudget = {
      name: "Monthly",
      baseAllowance: 10000,
      measurementMode: "spending",
      warningPercentage: 80,
    };

    expect(buildWebRequestSpec("create_budget", { newBudget })).toEqual({
      method: "POST",
      path: "/budgets",
      body: newBudget,
    });
  });

  it("maps budget updates to the budget detail route", () => {
    const updatedBudget = {
      expectedRevision: 0,
      name: "Updated monthly",
      baseAllowance: 20000,
      cadence: "month",
      categoryIds: [],
      measurementMode: "spending",
      rolloverMode: "off",
      warningPercentage: 80,
    };

    expect(
      buildWebRequestSpec("update_budget", {
        budgetId: "budget-1",
        updatedBudget,
      }),
    ).toEqual({
      method: "PUT",
      path: "/budgets/budget-1",
      body: updatedBudget,
    });
  });

  it("maps budget history with default pagination", () => {
    expect(buildWebRequestSpec("get_budget_history", { budgetId: "budget-1" })).toEqual({
      method: "GET",
      path: "/budgets/budget-1/history?page=1&perPage=50",
    });
  });
});
