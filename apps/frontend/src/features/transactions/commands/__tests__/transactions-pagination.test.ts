import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import { resetCommandTransports, setCommandTransports } from "@/commands/shared";

import { getFilteredTransactionIds } from "../transactions";

const invokeMock = vi.fn();

describe("getFilteredTransactionIds", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setCommandTransports({
      tauri: { invoke: invokeMock },
      web: { invoke: invokeMock },
    });
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
  });

  afterEach(() => {
    resetCommandTransports();
    vi.unstubAllEnvs();
  });

  it("loads matching ids in a single command call", async () => {
    invokeMock.mockResolvedValue(["tx-1", "tx-2", "tx-3"]);

    const filters = { query: "rent", transactionType: "expense" };
    const result = await getFilteredTransactionIds(filters);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual(["tx-1", "tx-2", "tx-3"]);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "get_filtered_transaction_ids" }),
      {
        filters,
        sort: null,
      },
    );
  });

  it("propagates command failures without retry fan-out", async () => {
    invokeMock.mockRejectedValue(new CommandError("Failed to load filtered transaction ids"));

    const result = await getFilteredTransactionIds();

    expect(Result.isFailure(result)).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});

describe("bulk transaction commands stay constant-cost", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setCommandTransports({
      tauri: { invoke: invokeMock },
      web: { invoke: invokeMock },
    });
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
  });

  afterEach(() => {
    resetCommandTransports();
    vi.unstubAllEnvs();
  });

  it("export and duplicate-key lookups use one command each regardless of candidate count", async () => {
    const { exportTransactionsCsv, findExistingDuplicateKeys } = await import("../transactions");

    invokeMock
      .mockResolvedValueOnce({ csv: "date,amount\n" })
      .mockResolvedValueOnce(["2026-01-15\u00001250\u0000rent"]);

    const exportResult = await exportTransactionsCsv({
      filters: { query: "rent" },
    });
    const duplicateResult = await findExistingDuplicateKeys(
      Array.from({ length: 250 }, (_, index) => ({
        transactionDate: "2026-01-15T12:00:00",
        amount: 1000 + index,
        currency: "EUR",
        description: `row-${index}`,
      })),
    );

    expect(Result.isSuccess(exportResult)).toBe(true);
    expect(Result.isSuccess(duplicateResult)).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "export_transactions_csv" }),
      expect.anything(),
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "find_existing_duplicate_keys" }),
      expect.anything(),
    );
  });
});
