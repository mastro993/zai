import { describe, expect, it } from "vitest";

import type { CommandArgs } from "@/commands/types";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import { buildRecurringCommandRequestSpec } from "../web-command-map";

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
  schedule: { type: "monthlyDay", day: 15 },
  firstScheduledLocal: "2026-08-15T09:30:00",
  totalOccurrences: 12,
  template,
};

const adoptionRequest = {
  transactionId,
  schedule: { type: "interval", every: 2, unit: "month" },
  totalOccurrences: null,
  template,
};

const repairRequest = {
  recurringTransactionId,
  expectedRevision: 7,
  repairFieldKey: "template",
  template,
};

const bulkRequest = {
  action: "pause",
  items: [{ recurringTransactionId, expectedRevision: 7 }],
};

const validRequests: Array<{
  command: string;
  args: CommandArgs;
  expected: WebRequestSpec;
}> = [
  {
    command: "get_recurring_transactions",
    args: {
      limit: 25,
      cursor: "feed-cursor",
      filters: { search: "rent", lifecycle: "paused", needsAttention: true },
    },
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
    command: "get_recurring_transaction",
    args: { recurringTransactionId },
    expected: { method: "GET", path: `/recurring-transactions/${recurringTransactionId}` },
  },
  {
    command: "get_recurring_transaction_occurrences",
    args: { recurringTransactionId, limit: 10, cursor: "occurrence-cursor" },
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/occurrences`,
      query: { limit: "10", cursor: "occurrence-cursor" },
    },
  },
  {
    command: "get_recurring_budget_projections",
    args: {
      horizonMonths: 6,
      includePausedBudgets: true,
      focusRecurringTransactionId: recurringTransactionId,
    },
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
    command: "get_recurring_processing_status",
    args: {},
    expected: { method: "GET", path: "/recurring-processing/status" },
  },
  {
    command: "get_transaction_recurring_provenance",
    args: { transactionId },
    expected: {
      method: "GET",
      path: `/recurring-transactions/provenance/${transactionId}`,
    },
  },
  {
    command: "create_recurring_transaction",
    args: { newRecurringTransaction },
    expected: { method: "POST", path: "/recurring-transactions", body: newRecurringTransaction },
  },
  {
    command: "update_recurring_transaction",
    args: {
      input: {
        recurringTransactionId,
        expectedRevision: 7,
        schedule: { type: "interval", every: 1, unit: "week" },
        nextScheduledLocal: "2026-08-22T09:30:00",
        totalOccurrences: null,
        template,
      },
    },
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
    command: "adopt_recurring_transaction",
    args: { request: adoptionRequest },
    expected: { method: "POST", path: "/recurring-transactions/adopt", body: adoptionRequest },
  },
  {
    command: "preview_recurring_adoption",
    args: { request: adoptionRequest },
    expected: {
      method: "POST",
      path: "/recurring-transactions/adoption-preview",
      body: adoptionRequest,
    },
  },
  ...(["pause", "resume", "stop", "delete"] as const).map((action) => ({
    command: `${action}_recurring_transaction`,
    args: { recurringTransactionId, expectedRevision: 7 },
    expected: {
      method: "POST" as const,
      path: `/recurring-transactions/${recurringTransactionId}/${action}`,
      body: { expectedRevision: 7 },
    },
  })),
  {
    command: "get_recurring_transaction_failure_history",
    args: { recurringTransactionId, limit: 15, cursor: "failure-cursor" },
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/failures`,
      query: { limit: "15", cursor: "failure-cursor" },
    },
  },
  {
    command: "get_recurring_generation_failure_diagnostics",
    args: { recurringTransactionId },
    expected: {
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/diagnostics`,
    },
  },
  {
    command: "preview_recurring_generation_repair",
    args: { request: repairRequest },
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/repair/preview`,
      body: repairRequest,
    },
  },
  {
    command: "repair_recurring_generation_failure",
    args: { input: repairRequest },
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/repair`,
      body: repairRequest,
    },
  },
  {
    command: "retry_recurring_generation_failure",
    args: { input: { recurringTransactionId, expectedRevision: 7 } },
    expected: {
      method: "POST",
      path: `/recurring-transactions/${recurringTransactionId}/retry`,
      body: { expectedRevision: 7 },
    },
  },
  {
    command: "get_matching_recurring_transaction_ids",
    args: { filters: { search: "rent", lifecycle: "active", needsAttention: false } },
    expected: {
      method: "GET",
      path: "/recurring-transactions/ids",
      query: { search: "rent", lifecycle: "active", needsAttention: "false" },
    },
  },
  {
    command: "preflight_recurring_bulk",
    args: { request: bulkRequest },
    expected: {
      method: "POST",
      path: "/recurring-transactions/bulk/preflight",
      body: bulkRequest,
    },
  },
  {
    command: "execute_recurring_bulk",
    args: { request: bulkRequest },
    expected: {
      method: "POST",
      path: "/recurring-transactions/bulk/execute",
      body: bulkRequest,
    },
  },
];

describe("recurring web request map", () => {
  it.each(validRequests)("maps $command", ({ command, args, expected }) => {
    expect(buildRecurringCommandRequestSpec(command, args)).toEqual(expected);
  });

  it("uses the backend defaults when optional filters and pagination are omitted", () => {
    expect(buildRecurringCommandRequestSpec("get_recurring_transactions")).toEqual({
      method: "GET",
      path: "/recurring-transactions",
      query: { limit: "50" },
    });
    expect(
      buildRecurringCommandRequestSpec("get_recurring_transaction_occurrences", {
        recurringTransactionId,
      }),
    ).toEqual({
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/occurrences`,
      query: { limit: "50" },
    });
    expect(
      buildRecurringCommandRequestSpec("get_recurring_transaction_failure_history", {
        recurringTransactionId,
      }),
    ).toEqual({
      method: "GET",
      path: `/recurring-transactions/${recurringTransactionId}/failures`,
      query: { limit: "20" },
    });
    expect(buildRecurringCommandRequestSpec("get_recurring_budget_projections")).toEqual({
      method: "GET",
      path: "/recurring-transactions/budget-projections",
      query: { horizonMonths: "3", includePausedBudgets: "false" },
    });
    expect(buildRecurringCommandRequestSpec("get_matching_recurring_transaction_ids")).toEqual({
      method: "GET",
      path: "/recurring-transactions/ids",
      query: {},
    });
  });
});
