import { describe, expect, it } from "vitest";

import {
  RECURRING_REPAIR_FIELDS,
  recurringGenerationFailureSchema,
  recurringRepairPreviewSchema,
} from "../recurring-failure";

const failure = (repairFieldKey: unknown) =>
  recurringGenerationFailureSchema.safeParse({
    recurringTransactionId: "recurring-1",
    scheduleRevisionId: "schedule-1",
    ordinal: 1,
    errorCode: "invalid_category",
    causeCategory: "template",
    repairFieldKey,
    correlationId: "correlation-1",
    failedScheduledLocal: "2026-01-01T09:00:00",
    firstFailedAt: "2026-01-01T09:00:00",
    lastFailedAt: "2026-01-01T09:00:00",
    attemptCount: 1,
    generationFailureAlertId: "alert-1",
  });

describe("recurring repair field contract", () => {
  it.each(RECURRING_REPAIR_FIELDS)("accepts %s", (repairFieldKey) => {
    expect(failure(repairFieldKey).success).toBe(true);
    expect(
      recurringRepairPreviewSchema.safeParse({
        repairFieldKey,
        affectedUnfulfilledSegmentCount: 1,
        includesFutureTemplate: true,
        nextAction: "repair",
      }).success,
    ).toBe(true);
  });

  it.each(["transaction_category_id", "notes", "template_revision_id"])(
    "rejects unknown field %s",
    (repairFieldKey) => {
      expect(failure(repairFieldKey).success).toBe(false);
    },
  );
});
