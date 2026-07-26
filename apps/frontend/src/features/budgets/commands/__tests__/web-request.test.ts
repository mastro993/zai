import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import type { CommandError } from "@/commands/errors";

import {
  buildCreateBudgetRequest,
  buildDeleteBudgetRequest,
  buildGetBudgetHistoryRequest,
  buildGetBudgetRequest,
  buildGetBudgetsRequest,
  buildPauseBudgetRequest,
  buildResumeBudgetRequest,
  buildUpdateBudgetRequest,
} from "../web-requests";

const unwrap = <T>(result: Result.Result<T, CommandError>): T | undefined => {
  expect(Result.isSuccess(result)).toBe(true);
  return Result.isSuccess(result) ? result.value : undefined;
};

const newBudget = {
  name: "Monthly",
  baseAllowance: 10000,
  cadence: "month" as const,
  categoryIds: ["category-1"],
  measurementMode: "spending" as const,
  rolloverMode: "off" as const,
  warningPercentage: 80,
};

describe("budget web requests", () => {
  it("maps list and detail reads", () => {
    expect(unwrap(buildGetBudgetsRequest({}))).toEqual({
      api: "cash-flow",
      method: "GET",
      path: "/budgets",
      query: undefined,
    });
    expect(unwrap(buildGetBudgetsRequest({ filter: "paused" }))).toEqual({
      api: "cash-flow",
      method: "GET",
      path: "/budgets",
      query: { filter: "paused" },
    });
    expect(unwrap(buildGetBudgetRequest({ budgetId: "budget-1" }))).toEqual({
      api: "cash-flow",
      method: "GET",
      path: "/budgets/budget-1",
    });
  });

  it("preserves budget payload and revision bodies", () => {
    expect(unwrap(buildCreateBudgetRequest({ newBudget }))).toEqual({
      api: "cash-flow",
      method: "POST",
      path: "/budgets",
      body: newBudget,
    });
    const updatedBudget = { ...newBudget, categoryIds: [], expectedRevision: 0 };
    expect(unwrap(buildUpdateBudgetRequest({ budgetId: "budget-1", updatedBudget }))).toEqual({
      api: "cash-flow",
      method: "PUT",
      path: "/budgets/budget-1",
      body: updatedBudget,
    });
    expect(unwrap(buildDeleteBudgetRequest({ budgetId: "budget-1", expectedRevision: 3 }))).toEqual(
      {
        api: "cash-flow",
        method: "DELETE",
        path: "/budgets/budget-1",
        body: { expectedRevision: 3 },
      },
    );
  });

  it("maps lifecycle and history requests", () => {
    expect(unwrap(buildPauseBudgetRequest({ budgetId: "budget-1", expectedRevision: 4 }))).toEqual({
      api: "cash-flow",
      method: "POST",
      path: "/budgets/budget-1/pause",
      body: { expectedRevision: 4 },
    });
    expect(unwrap(buildResumeBudgetRequest({ budgetId: "budget-1", expectedRevision: 5 }))).toEqual(
      {
        api: "cash-flow",
        method: "POST",
        path: "/budgets/budget-1/resume",
        body: { expectedRevision: 5 },
      },
    );
    expect(unwrap(buildGetBudgetHistoryRequest({ budgetId: "budget-1" }))).toEqual({
      api: "cash-flow",
      method: "GET",
      path: "/budgets/budget-1/history",
      query: { page: "1", perPage: "50" },
    });
  });

  it("rejects malformed revisions before transport", () => {
    expect(
      Result.isFailure(buildDeleteBudgetRequest({ budgetId: "budget-1", expectedRevision: -1 })),
    ).toBe(true);
  });
});
