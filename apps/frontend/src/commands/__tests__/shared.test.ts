import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError, invokeCommand } from "../shared";

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
});
