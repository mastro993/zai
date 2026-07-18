// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { downloadTextFile } from "@/commands/file-capabilities/download-text-file";
import { selectCsvImportFile } from "@/commands/file-capabilities/select-csv-import-file";
import type * as SharedCommands from "@/commands/shared";

import { exportTransactions } from "../transaction-export";
import { openTransactionImportFile } from "../transaction-import";

vi.mock("@/commands/file-capabilities/select-csv-import-file", () => ({
  selectCsvImportFile: vi.fn(),
}));

vi.mock("@/commands/file-capabilities/download-text-file", () => ({
  downloadTextFile: vi.fn(),
}));

const invokeDecodedCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/commands/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedCommands>();
  return {
    ...actual,
    invokeDecodedCommand: invokeDecodedCommandMock,
  };
});

const selectMock = vi.mocked(selectCsvImportFile);
const downloadMock = vi.mocked(downloadTextFile);

describe("transaction file capability routing", () => {
  beforeEach(() => {
    selectMock.mockReset();
    downloadMock.mockReset();
    invokeDecodedCommandMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes transaction CSV import through the shared file capability adapter", async () => {
    selectMock.mockResolvedValue({ name: "transactions.csv", content: "date,description,amount" });

    const result = await openTransactionImportFile();

    expect(selectMock).toHaveBeenCalledWith({ title: "Import transactions" });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual({ name: "transactions.csv", content: "date,description,amount" });
  });

  it("routes transaction CSV export through backend csv then shared file capability", async () => {
    invokeDecodedCommandMock.mockResolvedValue(
      Result.succeed({
        csv: "date,amount,type,description,notes,parent_category,category\n2026-07-09T12:30:00,3.50,expense,Coffee,,,",
      }),
    );
    downloadMock.mockResolvedValue("zai_transactions_20260710_112700.csv");

    const result = await exportTransactions({
      transactionIds: ["txn-1"],
    });

    expect(invokeDecodedCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "export_transactions_csv" }),
      {
        request: {
          filters: null,
          transactionIds: ["txn-1"],
        },
      },
    );
    expect(downloadMock).toHaveBeenCalledWith({
      title: "Export transactions",
      filename: expect.stringMatching(/^zai_transactions_\d{8}_\d{6}\.csv$/),
      content: expect.stringContaining("date,amount,type,description"),
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toBe("zai_transactions_20260710_112700.csv");
  });
});
