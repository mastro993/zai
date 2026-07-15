import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import type * as SharedCommands from "@/commands/shared";

import { getFilteredTransactionIds } from "../transactions";

const invokeDecodedCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/commands/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedCommands>();
  return {
    ...actual,
    invokeDecodedCommand: invokeDecodedCommandMock,
  };
});

describe("getFilteredTransactionIds", () => {
  beforeEach(() => {
    invokeDecodedCommandMock.mockReset();
  });

  it("loads matching ids in a single command call", async () => {
    invokeDecodedCommandMock.mockResolvedValue(Result.succeed(["tx-1", "tx-2", "tx-3"]));

    const filters = { query: "rent", transactionType: "expense" };
    const result = await getFilteredTransactionIds(filters);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual(["tx-1", "tx-2", "tx-3"]);
    expect(invokeDecodedCommandMock).toHaveBeenCalledTimes(1);
    expect(invokeDecodedCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "get_filtered_transaction_ids" }),
      {
        filters,
        sort: null,
      },
    );
  });

  it("propagates command failures without retry fan-out", async () => {
    invokeDecodedCommandMock.mockResolvedValue(
      Result.fail(new CommandError("Failed to load filtered transaction ids")),
    );

    const result = await getFilteredTransactionIds();

    expect(Result.isFailure(result)).toBe(true);
    expect(invokeDecodedCommandMock).toHaveBeenCalledTimes(1);
  });
});
