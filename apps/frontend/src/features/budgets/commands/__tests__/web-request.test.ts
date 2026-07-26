import { describe, expect, it } from "vitest";

import { buildBudgetCommandRequestSpec } from "../web-command-map";

describe("budget web requests", () => {
  it("maps list and detail reads", () => {
    expect(buildBudgetCommandRequestSpec("get_budgets")).toEqual({
      method: "GET",
      path: "/budgets",
      query: undefined,
    });
    expect(buildBudgetCommandRequestSpec("get_budgets", { filter: "paused" })).toEqual({
      method: "GET",
      path: "/budgets",
      query: { filter: "paused" },
    });
    expect(buildBudgetCommandRequestSpec("get_budget", { budgetId: "budget-1" })).toEqual({
      method: "GET",
      path: "/budgets/budget-1",
    });
  });

  it("maps budget creation without changing the payload", () => {
    const newBudget = {
      name: "Monthly",
      baseAllowance: 10000,
      cadence: "month",
      categoryIds: ["category-1"],
      measurementMode: "spending",
      rolloverMode: "off",
      warningPercentage: 80,
    };

    expect(buildBudgetCommandRequestSpec("create_budget", { newBudget })).toEqual({
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
      buildBudgetCommandRequestSpec("update_budget", {
        budgetId: "budget-1",
        updatedBudget,
      }),
    ).toEqual({
      method: "PUT",
      path: "/budgets/budget-1",
      body: updatedBudget,
    });
  });

  it("preserves revision-safe deletion and lifecycle bodies", () => {
    expect(
      buildBudgetCommandRequestSpec("delete_budget", {
        budgetId: "budget-1",
        expectedRevision: 3,
      }),
    ).toEqual({
      method: "DELETE",
      path: "/budgets/budget-1",
      body: { expectedRevision: 3 },
    });
    expect(
      buildBudgetCommandRequestSpec("pause_budget", {
        budgetId: "budget-1",
        expectedRevision: 4,
      }),
    ).toEqual({
      method: "POST",
      path: "/budgets/budget-1/pause",
      body: { expectedRevision: 4 },
    });
    expect(
      buildBudgetCommandRequestSpec("resume_budget", {
        budgetId: "budget-1",
        expectedRevision: 5,
      }),
    ).toEqual({
      method: "POST",
      path: "/budgets/budget-1/resume",
      body: { expectedRevision: 5 },
    });
  });

  it("maps budget history with default and explicit pagination", () => {
    expect(buildBudgetCommandRequestSpec("get_budget_history", { budgetId: "budget-1" })).toEqual({
      method: "GET",
      path: "/budgets/budget-1/history?page=1&perPage=50",
    });
    expect(
      buildBudgetCommandRequestSpec("get_budget_history", {
        budgetId: "budget-1",
        page: 3,
        perPage: 25,
      }),
    ).toEqual({
      method: "GET",
      path: "/budgets/budget-1/history?page=3&perPage=25",
    });
  });
});
