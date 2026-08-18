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
  expectedTransactionDate: "2026-08-15T09:30:00",
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

const check = <T>(
  build: (args: T) => Result.Result<WebRequestSpec, CommandError>,
  args: T,
  expected: Partial<WebRequestSpec>,
) => {
  const result = build(args);
  expect(Result.isSuccess(result)).toBe(true);
  if (Result.isFailure(result)) return;
  expect(result.value).toMatchObject(expected);
};

describe("recurring web requests", () => {
  it("maps request builders to HTTP contracts", () => {
    check(
      buildGetRecurringTransactionsRequest,
      {
        limit: 25,
        cursor: "feed-cursor",
        filters: { search: "rent", lifecycle: "paused", needsAttention: true },
      },
      {
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
    );
    check(
      buildGetRecurringTransactionRequest,
      { recurringTransactionId },
      { method: "GET", path: `/recurring-transactions/${recurringTransactionId}` },
    );
    check(
      buildGetRecurringOccurrencesRequest,
      { recurringTransactionId, limit: 10, cursor: "occurrence-cursor" },
      {
        method: "GET",
        path: `/recurring-transactions/${recurringTransactionId}/occurrences`,
        query: { limit: "10", cursor: "occurrence-cursor" },
      },
    );
    check(
      buildGetRecurringProjectionsRequest,
      {
        horizonMonths: 6,
        includePausedBudgets: true,
        focusRecurringTransactionId: recurringTransactionId,
      },
      {
        method: "GET",
        path: "/recurring-transactions/budget-projections",
        query: {
          horizonMonths: "6",
          includePausedBudgets: "true",
          focusRecurringTransactionId: recurringTransactionId,
        },
      },
    );
    check(buildGetRecurringProcessingStatusRequest, undefined, {
      method: "GET",
      path: "/recurring-processing/status",
    });
    check(
      buildGetTransactionProvenanceRequest,
      { transactionId },
      { method: "GET", path: `/recurring-transactions/provenance/${transactionId}` },
    );
    check(
      buildCreateRecurringTransactionRequest,
      { newRecurringTransaction },
      { method: "POST", path: "/recurring-transactions", body: newRecurringTransaction },
    );
    check(
      buildUpdateRecurringTransactionRequest,
      {
        input: {
          recurringTransactionId,
          expectedRevision: 7,
          schedule: { type: "interval", every: 1, unit: "week" },
          nextScheduledLocal: "2026-08-22T09:30:00",
          totalOccurrences: null,
          template,
        },
      },
      {
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
    );
    check(
      buildAdoptRecurringTransactionRequest,
      { request: adoptionRequest },
      { method: "POST", path: "/recurring-transactions/adopt", body: adoptionRequest },
    );
    check(
      buildPreviewRecurringAdoptionRequest,
      { request: adoptionPreviewRequest },
      {
        method: "POST",
        path: "/recurring-transactions/adoption-preview",
        body: adoptionPreviewRequest,
      },
    );
    for (const [action, build] of [
      ["pause", buildPauseRecurringTransactionRequest],
      ["resume", buildResumeRecurringTransactionRequest],
      ["stop", buildStopRecurringTransactionRequest],
      ["delete", buildDeleteRecurringTransactionRequest],
    ] as const) {
      check(
        build,
        { recurringTransactionId, expectedRevision: 7 },
        {
          method: "POST",
          path: `/recurring-transactions/${recurringTransactionId}/${action}`,
          body: { expectedRevision: 7 },
        },
      );
    }
    check(
      buildGetRecurringFailureHistoryRequest,
      { recurringTransactionId, limit: 15, cursor: "failure-cursor" },
      {
        method: "GET",
        path: `/recurring-transactions/${recurringTransactionId}/failures`,
        query: { limit: "15", cursor: "failure-cursor" },
      },
    );
    check(
      buildGetRecurringDiagnosticsRequest,
      { recurringTransactionId },
      {
        method: "GET",
        path: `/recurring-transactions/${recurringTransactionId}/diagnostics`,
      },
    );
    check(
      buildPreviewRecurringRepairRequest,
      { request: repairRequest },
      {
        method: "POST",
        path: `/recurring-transactions/${recurringTransactionId}/repair/preview`,
        body: repairRequest,
      },
    );
    check(
      buildRepairRecurringFailureRequest,
      { input: repairRequest },
      {
        method: "POST",
        path: `/recurring-transactions/${recurringTransactionId}/repair`,
        body: repairRequest,
      },
    );
    check(
      buildRetryRecurringFailureRequest,
      { input: { recurringTransactionId, expectedRevision: 7 } },
      {
        method: "POST",
        path: `/recurring-transactions/${recurringTransactionId}/retry`,
        body: { expectedRevision: 7 },
      },
    );
    check(
      buildMatchingRecurringIdsRequest,
      { filters: { search: "rent", lifecycle: "active", needsAttention: false } },
      {
        method: "GET",
        path: "/recurring-transactions/ids",
        query: { search: "rent", lifecycle: "active", needsAttention: "false" },
      },
    );
    check(
      buildPreflightRecurringBulkRequest,
      { request: bulkRequest },
      { method: "POST", path: "/recurring-transactions/bulk/preflight", body: bulkRequest },
    );
    check(
      buildExecuteRecurringBulkRequest,
      { request: bulkRequest },
      { method: "POST", path: "/recurring-transactions/bulk/execute", body: bulkRequest },
    );
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
    const requestWithTemplate = { ...adoptionPreviewRequest, template };
    const result = buildPreviewRecurringAdoptionRequest({
      request: requestWithTemplate,
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
        buildExecuteRecurringBulkRequest({
          request: {
            action: "pause",
            items: [{ recurringTransactionId: "", expectedRevision: 7 }],
          },
        }),
      ),
    ).toBe(true);
  });
});
