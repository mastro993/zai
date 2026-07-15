import { describe, expect, it } from "vitest";

import { Result } from "@praha/byethrow";
import { z } from "zod";

import { CommandError } from "../errors";
import { decodeCommandValue } from "../decode-command-result";
import { budgetSchema } from "@/features/cash-flow/types/budget";
import { domainAlertListPageSchema } from "@/features/alerts/types/domain-alert";

describe("decodeCommandValue", () => {
  it("accepts valid budget payloads", () => {
    const payload = {
      id: "budget-1",
      name: "Monthly",
      revision: 0,
      paused: false,
      categoryIds: [],
      cadence: "month",
      measurementMode: "spending",
      baseAllowance: 10000,
      rolloverMode: "off",
      warningPercentage: 80,
      currentPeriod: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
        baseAllowance: 10000,
        effectiveAllowance: 10000,
        netBudgetSpending: 0,
        remainingAllowance: 10000,
        status: "onTrack",
      },
    };

    const result = decodeCommandValue("get_budget", payload, budgetSchema);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.value.id).toBe("budget-1");
    }
  });

  it("rejects malformed budget payloads", () => {
    const result = decodeCommandValue("get_budget", { id: "budget-1" }, budgetSchema);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(CommandError);
      expect(result.error.message).toBe("Invalid response for get_budget");
    }
  });

  it("accepts void command results", () => {
    const result = decodeCommandValue("delete_budget", undefined, "void");
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("accepts alert list pages and rejects malformed pages", () => {
    const valid = decodeCommandValue(
      "list_alerts",
      { items: [], nextCursor: null },
      domainAlertListPageSchema,
    );
    expect(Result.isSuccess(valid)).toBe(true);

    const invalid = decodeCommandValue(
      "list_alerts",
      { items: "not-an-array" },
      domainAlertListPageSchema,
    );
    expect(Result.isFailure(invalid)).toBe(true);
  });

  it("accepts numeric alert count responses", () => {
    const result = decodeCommandValue("get_unread_alert_count", 3, z.number());
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.value).toBe(3);
    }
  });
});
