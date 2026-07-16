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

describe("bulk transaction commands stay constant-cost", () => {
  beforeEach(() => {
    invokeDecodedCommandMock.mockReset();
  });

  it("export and duplicate-key lookups use one command each regardless of candidate count", async () => {
    const { exportTransactionsCsv, findExistingDuplicateKeys } = await import("../transactions");

    invokeDecodedCommandMock
      .mockResolvedValueOnce(Result.succeed({ csv: "date,amount\n" }))
      .mockResolvedValueOnce(Result.succeed(["2026-01-15\u00001250\u0000rent"]));

    const exportResult = await exportTransactionsCsv({
      filters: { query: "rent" },
    });
    const duplicateResult = await findExistingDuplicateKeys(
      Array.from({ length: 250 }, (_, index) => ({
        transactionDate: "2026-01-15T12:00:00",
        amount: 1000 + index,
        description: `row-${index}`,
      })),
    );

    expect(Result.isSuccess(exportResult)).toBe(true);
    expect(Result.isSuccess(duplicateResult)).toBe(true);
    expect(invokeDecodedCommandMock).toHaveBeenCalledTimes(2);
    expect(invokeDecodedCommandMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "export_transactions_csv" }),
      expect.anything(),
    );
    expect(invokeDecodedCommandMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "find_existing_duplicate_keys" }),
      expect.anything(),
    );
  });
});
