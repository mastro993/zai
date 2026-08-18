import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CATEGORY_COMMANDS } from "@/features/categories/commands/registry";

import type { CommandTransport } from "../types";
import { CommandError, getAffectedBudgets } from "../errors";
import { invokeDecodedCommand, resetCommandTransports, setCommandTransports } from "../shared";

const invokeMock = vi.fn();

const fakeTransport = (): CommandTransport => ({
  invoke: invokeMock,
});

describe("desktop command transport", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setCommandTransports({
      tauri: fakeTransport(),
      web: fakeTransport(),
    });
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
  });

  afterEach(() => {
    resetCommandTransports();
    vi.unstubAllEnvs();
  });

  it("delegates desktop commands to the injected transport", async () => {
    const value: Array<never> = [];
    invokeMock.mockResolvedValue(value);

    const result = await invokeDecodedCommand(CATEGORY_COMMANDS.get_transaction_categories, {
      parentId: null,
    });

    expect(invokeMock).toHaveBeenCalledWith(CATEGORY_COMMANDS.get_transaction_categories, {
      parentId: null,
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual(value);
  });

  it("rejects desktop commands when Tauri IPC is unavailable", async () => {
    resetCommandTransports();

    const result = await invokeDecodedCommand(CATEGORY_COMMANDS.get_transaction_categories, {
      parentId: null,
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toEqual(
      new CommandError("Desktop commands are only available in the client"),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("maps rejected desktop invocations into failed command results", async () => {
    invokeMock.mockRejectedValue(new Error("IPC failed"));

    const result = await invokeDecodedCommand(CATEGORY_COMMANDS.get_transaction_categories, {
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

    const result = await invokeDecodedCommand(CATEGORY_COMMANDS.create_transaction_category, {
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
