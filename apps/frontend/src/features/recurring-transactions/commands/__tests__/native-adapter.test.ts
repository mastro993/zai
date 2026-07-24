import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";

import {
  createRecurringTransaction,
  getRecurringProcessingStatus,
  getRecurringTransaction,
  getRecurringTransactionOccurrences,
  getRecurringTransactionFailureHistory,
  getTransactionRecurringProvenance,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  stopRecurringTransaction,
} from "../recurring-transactions";
import type { RecurringFormValues } from "../../types/recurring-transaction";

const invokeMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

describe("recurring Tauri command adapter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
    vi.stubGlobal("window", {});
    invokeMock.mockReset();
    isTauriMock.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("invokes native processing status and decodes its response", async () => {
    invokeMock.mockResolvedValue({ status: "idle" });

    const result = await getRecurringProcessingStatus();

    expect(invokeMock).toHaveBeenCalledWith("get_recurring_processing_status", {});
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toEqual({ status: "idle" });
  });

  it("preserves frontend paging payload and maps native errors", async () => {
    invokeMock.mockRejectedValue({
      code: "internal",
      message: "Failed to load failure history: An internal error occurred",
    });

    const result = await getRecurringTransactionFailureHistory("native-source", 20, "cursor-1");

    expect(invokeMock).toHaveBeenCalledWith("get_recurring_transaction_failure_history", {
      recurringTransactionId: "native-source",
      limit: 20,
      cursor: "cursor-1",
    });
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toMatchObject({
      code: "internal",
      message: "Failed to load failure history: An internal error occurred",
    });
  });

  it("uses native payloads for the recurring journey", async () => {
    invokeMock.mockResolvedValue({});
    const values: RecurringFormValues = {
      scheduleKind: "interval",
      intervalEvery: "1",
      intervalUnit: "day",
      monthlyDay: "1",
      firstScheduledLocal: "2026-01-10T09:00",
      totalMode: "finite",
      totalOccurrences: "2",
      description: "Native smoke recurring",
      amount: 1200,
      transactionType: "expense",
      transactionCategoryId: undefined,
      notes: undefined,
    };

    await createRecurringTransaction(values);
    await getRecurringTransaction("source-1");
    await getRecurringTransactionOccurrences("source-1", 50);
    await getTransactionRecurringProvenance("transaction-1");
    await pauseRecurringTransaction("source-1", 1);
    await resumeRecurringTransaction("source-1", 2);
    await stopRecurringTransaction("source-1", 3);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "create_recurring_transaction", {
      newRecurringTransaction: {
        schedule: { type: "interval", every: 1, unit: "day" },
        firstScheduledLocal: "2026-01-10T09:00:00",
        totalOccurrences: 2,
        template: {
          description: "Native smoke recurring",
          amount: 1200,
          transactionType: "expense",
          transactionCategoryId: null,
          notes: null,
        },
      },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "get_recurring_transaction", {
      recurringTransactionId: "source-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "get_recurring_transaction_occurrences", {
      recurringTransactionId: "source-1",
      limit: 50,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "get_transaction_recurring_provenance", {
      transactionId: "transaction-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "pause_recurring_transaction", {
      recurringTransactionId: "source-1",
      expectedRevision: 1,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, "resume_recurring_transaction", {
      recurringTransactionId: "source-1",
      expectedRevision: 2,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(7, "stop_recurring_transaction", {
      recurringTransactionId: "source-1",
      expectedRevision: 3,
    });
  });
});
