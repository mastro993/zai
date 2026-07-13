import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError, getAffectedBudgets } from "../errors";
import { invokeCommand } from "../shared";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("desktop command transport", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delegates desktop commands to Tauri IPC", async () => {
    const value = { id: "category-1" };
    invokeMock.mockResolvedValue(value);

    const result = await invokeCommand<typeof value>("get_transaction_categories", {
      parentId: null,
    });

    expect(invokeMock).toHaveBeenCalledWith("get_transaction_categories", {
      parentId: null,
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual(value);
  });

  it("maps rejected desktop invocations into failed command results", async () => {
    invokeMock.mockRejectedValue(new Error("IPC failed"));

    const result = await invokeCommand("get_transaction_categories", {
      parentId: null,
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toBeInstanceOf(CommandError);
    expect(result.error.message).toBe("IPC failed");
  });

  it("preserves structured fields from rejected desktop invocations", async () => {
    invokeMock.mockRejectedValue({
      code: "conflict",
      message: "Failed to create transaction category: Conflict",
      details: { resource: "category" },
    });

    const result = await invokeCommand("create_transaction_category", {
      newCategory: { name: "Food" },
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toMatchObject({
      code: "conflict",
      details: { resource: "category" },
      message: "Failed to create transaction category: Conflict",
    });
  });
});

describe("budget impact errors", () => {
  it("extracts affected budgets from structured command details", () => {
    const error = new CommandError("confirmation required", {
      code: "budgetImpactConfirmationRequired",
      details: {
        affectedBudgets: [
          { id: "budget-1", name: "Monthly food" },
          { id: 42, name: "invalid" },
        ],
      },
    });

    expect(getAffectedBudgets(error)).toEqual([{ id: "budget-1", name: "Monthly food" }]);
  });
});
