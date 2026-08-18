import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";

import { resetCommandTransports, setCommandTransports } from "@/commands/shared";
import { sampleTransaction } from "@/features/transactions/types/sample";

import type { RecurringFormValues } from "../../types/recurring-transaction";
import { RECURRING_COMMANDS } from "../registry";
import {
  adoptRecurringTransaction,
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

const invokeMock = vi.fn();

describe("recurring Tauri command adapter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
    invokeMock.mockReset();
    setCommandTransports({
      tauri: { invoke: invokeMock },
      web: { invoke: invokeMock },
    });
  });

  afterEach(() => {
    resetCommandTransports();
    vi.unstubAllEnvs();
  });

  it("invokes native processing status and decodes its response", async () => {
    invokeMock.mockResolvedValue({ status: "idle" });

    const result = await getRecurringProcessingStatus();

    expect(invokeMock).toHaveBeenCalledWith(
      RECURRING_COMMANDS.get_recurring_processing_status,
      undefined,
    );
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

    expect(invokeMock).toHaveBeenCalledWith(
      RECURRING_COMMANDS.get_recurring_transaction_failure_history,
      {
        recurringTransactionId: "native-source",
        limit: 20,
        cursor: "cursor-1",
      },
    );
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
      totalOccurrences: "2",
      description: "Native smoke recurring",
      amount: 1200,
      currency: "EUR",
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

    expect(invokeMock).toHaveBeenNthCalledWith(1, RECURRING_COMMANDS.create_recurring_transaction, {
      newRecurringTransaction: {
        schedule: { type: "interval", every: 1, unit: "day" },
        firstScheduledLocal: "2026-01-10T09:00:00",
        totalOccurrences: 2,
        template: {
          description: "Native smoke recurring",
          amount: 1200,
          currency: "EUR",
          transactionType: "expense",
          transactionCategoryId: null,
          notes: null,
        },
      },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, RECURRING_COMMANDS.get_recurring_transaction, {
      recurringTransactionId: "source-1",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(
      3,
      RECURRING_COMMANDS.get_recurring_transaction_occurrences,
      {
        recurringTransactionId: "source-1",
        limit: 50,
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      4,
      RECURRING_COMMANDS.get_transaction_recurring_provenance,
      {
        transactionId: "transaction-1",
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(5, RECURRING_COMMANDS.pause_recurring_transaction, {
      recurringTransactionId: "source-1",
      expectedRevision: 1,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, RECURRING_COMMANDS.resume_recurring_transaction, {
      recurringTransactionId: "source-1",
      expectedRevision: 2,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(7, RECURRING_COMMANDS.stop_recurring_transaction, {
      recurringTransactionId: "source-1",
      expectedRevision: 3,
    });
  });

  it("maps a blank occurrence count to an indefinite native payload", async () => {
    invokeMock.mockResolvedValue({});

    const values: RecurringFormValues = {
      scheduleKind: "interval",
      intervalEvery: "1",
      intervalUnit: "month",
      monthlyDay: "1",
      firstScheduledLocal: "2026-01-10T09:00",
      totalOccurrences: "",
      description: "Indefinite recurring",
      amount: 1200,
      currency: "EUR",
      transactionType: "expense",
      transactionCategoryId: undefined,
      notes: undefined,
    };

    await createRecurringTransaction(values);

    expect(invokeMock).toHaveBeenCalledWith(RECURRING_COMMANDS.create_recurring_transaction, {
      newRecurringTransaction: expect.objectContaining({
        totalOccurrences: null,
      }),
    });
  });

  it("builds adoption template from source transaction", async () => {
    invokeMock.mockResolvedValue({});
    const transaction = sampleTransaction({
      id: "transaction-1",
      description: " Rent ",
      amount: 120000,
      transactionDate: "2026-01-10T09:00:00",
      transactionType: "income",
      transactionCategoryId: "housing",
      notes: " Paid by bank transfer ",
    });
    const values: RecurringFormValues = {
      scheduleKind: "interval",
      intervalEvery: "2",
      intervalUnit: "month",
      monthlyDay: "1",
      firstScheduledLocal: "2026-01-10T09:00",
      totalOccurrences: "12",
      description: "Rent",
      amount: 120000,
      currency: "EUR",
      transactionType: "income",
      transactionCategoryId: "housing",
      notes: "Paid by bank transfer",
    };

    await adoptRecurringTransaction(transaction, values);

    expect(invokeMock).toHaveBeenCalledWith(RECURRING_COMMANDS.adopt_recurring_transaction, {
      request: {
        transactionId: "transaction-1",
        expectedTransactionDate: "2026-01-10T09:00:00",
        schedule: { type: "interval", every: 2, unit: "month" },
        totalOccurrences: 12,
        template: {
          description: "Rent",
          amount: 120000,
          currency: "EUR",
          transactionType: "income",
          transactionCategoryId: "housing",
          notes: "Paid by bank transfer",
        },
      },
    });
  });
});
