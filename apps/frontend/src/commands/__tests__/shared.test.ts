import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError, getAffectedBudgets } from "../errors";
import { invokeCommand } from "../shared";

const invokeMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

describe("desktop command transport", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(true);
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {
        invoke: invokeMock,
      },
    });
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

  it("fails clearly when the page is outside the Tauri webview", async () => {
    isTauriMock.mockReturnValue(false);
    vi.stubGlobal("window", {});

    const result = await invokeCommand("get_transaction_categories");

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error.message).toContain("Zai desktop window");
    expect(invokeMock).not.toHaveBeenCalled();
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
