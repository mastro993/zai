// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecurringBudgetImpact } from "../recurring-budget-impact";

describe("RecurringBudgetImpact", () => {
  it("keeps typed source errors visible when no budget periods exist", () => {
    render(
      <RecurringBudgetImpact
        impact={{
          state: "ready",
          projection: {
            observedLocal: "2026-08-05T12:00:00",
            throughLocal: "2026-09-05T12:00:00",
            horizonMonths: 1,
            complete: false,
            periods: [],
            sourceErrors: [
              {
                kind: "generationBlocked",
                recurringTransactionId: "rt-blocked",
                message: "Generation-blocked source excluded from projection",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("Forecast incomplete")).toBeTruthy();
    expect(screen.getByText("Generation blocked")).toBeTruthy();
    expect(
      screen.getByText(
        "No projected occurrence from this source is included in an active budget period.",
      ),
    ).toBeTruthy();
  });
});
