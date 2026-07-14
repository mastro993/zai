import { describe, expect, it } from "vitest";

import { mergeReconciledAlertPage } from "../lib/merge-page";
import type { DomainAlertListPage } from "../types/domain-alert";

const alert = (id: string, createdAt: string) => ({
  id: `${id}0e8400-e29b-41d4-a716-446655440000`,
  producerKey: "budget.status",
  occurrenceKey: id,
  severity: "warning" as const,
  title: id,
  body: "Body",
  destination: null,
  data: null,
  createdAt,
  readAt: null,
});

describe("mergeReconciledAlertPage", () => {
  it("updates canonical rows while retaining loaded history", () => {
    const retained = alert("7", "2026-07-13T12:00:00");
    const current = [alert("8", "2026-07-14T12:00:00"), retained];
    const page: DomainAlertListPage = {
      items: [{ ...current[0], title: "Updated" }],
      nextCursor: "next",
    };

    expect(mergeReconciledAlertPage(current, page)).toEqual([
      { ...current[0], title: "Updated" },
      retained,
    ]);
  });
});
