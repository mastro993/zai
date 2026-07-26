import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import type { WebRequestSpec } from "@/commands/web-request-spec";
import type { CommandError } from "@/commands/errors";

import {
  buildAdoptRecurringTransactionRequest,
  buildCreateRecurringTransactionRequest,
  buildDeleteRecurringTransactionRequest,
  buildExecuteRecurringBulkRequest,
  buildGetRecurringDiagnosticsRequest,
  buildGetRecurringFailureHistoryRequest,
  buildGetRecurringOccurrencesRequest,
  buildGetRecurringProcessingStatusRequest,
  buildGetRecurringProjectionsRequest,
  buildGetRecurringTransactionRequest,
  buildGetRecurringTransactionsRequest,
  buildGetTransactionProvenanceRequest,
  buildMatchingRecurringIdsRequest,
  buildPauseRecurringTransactionRequest,
  buildPreviewRecurringAdoptionRequest,
  buildPreviewRecurringRepairRequest,
  buildPreflightRecurringBulkRequest,
  buildRepairRecurringFailureRequest,
  buildResumeRecurringTransactionRequest,
  buildRetryRecurringFailureRequest,
  buildStopRecurringTransactionRequest,
  buildUpdateRecurringTransactionRequest,
} from "../web-requests";

const recurringTransactionId = "recurring-1";
const transactionId = "transaction-1";
const template = {
  description: "Monthly rent",
  amount: 120000,
  transactionType: "expense",
  transactionCategoryId: "housing",
  notes: "Paid by bank transfer",
};
const newRecurringTransaction = {
  schedule: { type: "monthlyDay" as const, day: 15 },
  firstScheduledLocal: "2026-08-15T09:30:00",
  totalOccurrences: 12,
  template,
};
const adoptionRequest = {
  transactionId,
  schedule: { type: "interval" as const, every: 2, unit: "month" as const },
  totalOccurrences: null,
  template,
};
const adoptionPreviewRequest = {
  transactionId,
  schedule: adoptionRequest.schedule,
  totalOccurrences: adoptionRequest.totalOccurrences,
};
const repairRequest = {
  recurringTransactionId,
  expectedRevision: 7,
  repairFieldKey: "amount" as const,
  template,
};
const bulkRequest = {
  action: "pause" as const,
  items: [{ recurringTransactionId, expectedRevision: 7 }],
};

type Builder = (args: never) => Result.Result<WebRequestSpec, CommandError>;
const requestCases: Array<{
  name: string;
  build: Builder;
  args: never;
  expected: Partial<WebRequestSpec>;
}> = [
  {
    name: "feed",
    build: buildGetRecurringTransactionsRequest as Builder,
    args: {
      limit: 25,
      cursor: "feed-cursor",
      filters: { search: "rent", lifecycle: "paused", needsAttention: true },
    } as never,
    expected: {
      method: "GET",
      path: "/recurring-transactions",
      query: {
        limit: "25",
        cursor: "feed-cursor",
        search: "rent",
        lifecycle: "paused",
        needsAttention: "true",
      },
    },
  },
  {
    name: "detail",
    build: buildGetRecurringTransactionRequest as Builder,
    args: { recurringTransactionId } as never,
    expected: { method: "GET", path: `/recurring-transactions/${recurringTransactionId}` },
  },
  {
    name: "occurrences",
    build: buildGetRecurringOccurrencesRequest as Builder,
    args: { recurringTransactionId, limit: 10, cursor: "occurrence-cursor" } as never,
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/occurrences`,
      query: { limit: "10", cursor: "occurrence-cursor" },
    },
  },
  {
    name: "projections",
    build: buildGetRecurringProjectionsRequest as Builder,
    args: {
      horizonMonths: 6,
      includePausedBudgets: true,
      focusRecurringTransactionId: recurringTransactionId,
    } as never,
    expected: {
      method: "GET",
      path: "/recurring-transactions/budget-projections",
      query: {
        horizonMonths: "6",
        includePausedBudgets: "true",
        focusRecurringTransactionId: recurringTransactionId,
      },
    },
  },
  {
    name: "processing status",
    build: buildGetRecurringProcessingStatusRequest as Builder,
    args: undefined as never,
    expected: { method: "GET", path: "/recurring-processing/status" },
  },
  {
    name: "provenance",
    build: buildGetTransactionProvenanceRequest as Builder,
    args: { transactionId } as never,
    expected: { method: "GET", path: `/recurring-transactions/provenance/${transactionId}` },
  },
  {
    name: "create",
    build: buildCreateRecurringTransactionRequest as Builder,
    args: { newRecurringTransaction } as never,
    expected: { method: "POST", path: "/recurring-transactions", body: newRecurringTransaction },
  },
  {
    name: "update",
    build: buildUpdateRecurringTransactionRequest as Builder,
    args: {
      input: {
        recurringTransactionId,
        expectedRevision: 7,
        schedule: { type: "interval", every: 1, unit: "week" },
        nextScheduledLocal: "2026-08-22T09:30:00",
        totalOccurrences: null,
        template,
      },
    } as never,
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}`,
      body: {
        recurringTransactionId,
        expectedRevision: 7,
        schedule: { type: "interval", every: 1, unit: "week" },
        nextScheduledLocal: "2026-08-22T09:30:00",
        totalOccurrences: null,
        template,
      },
    },
  },
  {
    name: "adopt",
    build: buildAdoptRecurringTransactionRequest as Builder,
    args: { request: adoptionRequest } as never,
    expected: { method: "POST", path: "/recurring-transactions/adopt", body: adoptionRequest },
  },
  {
    name: "adoption preview",
    build: buildPreviewRecurringAdoptionRequest as Builder,
    args: { request: adoptionPreviewRequest } as never,
    expected: {
      method: "POST",
      path: "/recurring-transactions/adoption-preview",
      body: adoptionPreviewRequest,
    },
  },
  ...(["pause", "resume", "stop", "delete"] as const).map((action) => ({
    name: action,
    build: {
      pause: buildPauseRecurringTransactionRequest,
      resume: buildResumeRecurringTransactionRequest,
      stop: buildStopRecurringTransactionRequest,
      delete: buildDeleteRecurringTransactionRequest,
    }[action] as Builder,
    args: { recurringTransactionId, expectedRevision: 7 } as never,
    expected: {
      method: "POST" as const,
      path: `/recurring-transactions/${recurringTransactionId}/${action}`,
      body: { expectedRevision: 7 },
    },
  })),
  {
    name: "failure history",
    build: buildGetRecurringFailureHistoryRequest as Builder,
    args: { recurringTransactionId, limit: 15, cursor: "failure-cursor" } as never,
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/failures`,
      query: { limit: "15", cursor: "failure-cursor" },
    },
  },
  {
    name: "diagnostics",
    build: buildGetRecurringDiagnosticsRequest as Builder,
    args: { recurringTransactionId } as never,
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/diagnostics`,
    },
  },
  {
    name: "repair preview",
    build: buildPreviewRecurringRepairRequest as Builder,
    args: { request: repairRequest } as never,
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/repair/preview`,
      body: repairRequest,
    },
  },
  {
    name: "repair",
    build: buildRepairRecurringFailureRequest as Builder,
    args: { input: repairRequest } as never,
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/repair`,
      body: repairRequest,
    },
  },
  {
    name: "retry",
    build: buildRetryRecurringFailureRequest as Builder,
    args: { input: { recurringTransactionId, expectedRevision: 7 } } as never,
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/retry`,
      body: { expectedRevision: 7 },
    },
  },
  {
    name: "matching ids",
    build: buildMatchingRecurringIdsRequest as Builder,
    args: { filters: { search: "rent", lifecycle: "active", needsAttention: false } } as never,
    expected: {
      method: "GET",
      path: "/recurring-transactions/ids",
      query: { search: "rent", lifecycle: "active", needsAttention: "false" },
    },
  },
  {
    name: "bulk preflight",
    build: buildPreflightRecurringBulkRequest as Builder,
    args: { request: bulkRequest } as never,
    expected: { method: "POST", path: "/recurring-transactions/bulk/preflight", body: bulkRequest },
  },
  {
    name: "bulk execute",
    build: buildExecuteRecurringBulkRequest as Builder,
    args: { request: bulkRequest } as never,
    expected: { method: "POST", path: "/recurring-transactions/bulk/execute", body: bulkRequest },
  },
];

describe("recurring web requests", () => {
  it.each(requestCases)("maps $name", ({ build, args, expected }) => {
    const result = build(args);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) return;
    expect(result.value).toMatchObject({ ...expected });
  });

  it("uses backend defaults when optional values are omitted", () => {
    const feed = buildGetRecurringTransactionsRequest({});
    expect(Result.isSuccess(feed) && feed.value.query).toEqual({ limit: "50" });
    const projection = buildGetRecurringProjectionsRequest({});
    expect(Result.isSuccess(projection) && projection.value.query).toEqual({
      horizonMonths: "3",
      includePausedBudgets: "false",
    });
    const matching = buildMatchingRecurringIdsRequest({});
    expect(Result.isSuccess(matching) && matching.value.query).toEqual({});
  });

  it("keeps adoption preview bodies separate from adoption templates", () => {
    const result = buildPreviewRecurringAdoptionRequest({
      request: { ...adoptionPreviewRequest, template } as never,
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) return;
    expect(result.value.body).toEqual(adoptionPreviewRequest);
  });

  it("rejects malformed identifiers, revisions, and records locally", () => {
    expect(
      Result.isFailure(buildGetRecurringTransactionRequest({ recurringTransactionId: "" })),
    ).toBe(true);
    for (const repairFieldKey of ["amount", "transactionCategoryId"] as const) {
      expect(
        Result.isSuccess(
          buildPreviewRecurringRepairRequest({
            request: { ...repairRequest, repairFieldKey },
          }),
        ),
      ).toBe(true);
    }
    expect(
      Result.isFailure(
        buildPauseRecurringTransactionRequest({ recurringTransactionId, expectedRevision: 0 }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        buildExecuteRecurringBulkRequest({ request: { action: "pause", items: "bad" as never } }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        buildPreviewRecurringRepairRequest({
          request: { ...repairRequest, repairFieldKey: "template" as never },
        }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        buildRepairRecurringFailureRequest({
          input: { ...repairRequest, repairFieldKey: "transaction_category_id" as never },
        }),
      ),
    ).toBe(true);
  });
});
