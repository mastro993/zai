// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import * as downloadTextFileModule from "@/commands/file-capabilities/download-text-file";
import * as selectCsvImportFileModule from "@/commands/file-capabilities/select-csv-import-file";
import { resetCommandTransports, setCommandTransports } from "@/commands/shared";

import { exportTransactions } from "../transaction-export";
import { openTransactionImportFile } from "../transaction-import";

const invokeMock = vi.fn();

describe("transaction file capability routing", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setCommandTransports({
      tauri: { invoke: invokeMock },
      web: { invoke: invokeMock },
    });
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
    vi.spyOn(selectCsvImportFileModule, "selectCsvImportFile").mockReset();
    vi.spyOn(downloadTextFileModule, "downloadTextFile").mockReset();
  });

  afterEach(() => {
    resetCommandTransports();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("routes transaction CSV import through the shared file capability adapter", async () => {
    vi.mocked(selectCsvImportFileModule.selectCsvImportFile).mockResolvedValue({
      name: "transactions.csv",
      content: "date,description,amount",
    });

    const result = await openTransactionImportFile();

    expect(selectCsvImportFileModule.selectCsvImportFile).toHaveBeenCalledWith({
      title: "Import transactions",
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual({ name: "transactions.csv", content: "date,description,amount" });
  });

  it("routes transaction CSV export through backend csv then shared file capability", async () => {
    invokeMock.mockResolvedValue({
      csv: "date,amount,type,description,notes,parent_category,category\n2026-07-09T12:30:00,3.50,expense,Coffee,,,",
    });
    vi.mocked(downloadTextFileModule.downloadTextFile).mockResolvedValue(
      "zai_transactions_20260710_112700.csv",
    );

    const result = await exportTransactions({
      transactionIds: ["txn-1"],
    });

    expect(invokeMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "export_transactions_csv" }),
      {
        request: {
          filters: null,
          transactionIds: ["txn-1"],
        },
      },
    );
    expect(downloadTextFileModule.downloadTextFile).toHaveBeenCalledWith({
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
