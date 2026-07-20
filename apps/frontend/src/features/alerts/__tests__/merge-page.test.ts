import { describe, expect, it } from "vitest";

import { mergeReconciledAlertPage } from "../lib/merge-page";
import type { DomainAlert, DomainAlertListPage } from "../types/domain-alert";

const unreadAlert: DomainAlert = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  producerKey: "budget.status",
  occurrenceKey: "a",
  severity: "warning",
  title: "Warning alert",
  body: "Body",
  createdAt: "2026-07-14T10:00:00",
  updatedAt: "2026-07-14T10:00:00",
  readAt: null,
};

const readAlert: DomainAlert = {
  ...unreadAlert,
  readAt: "2026-07-14T11:00:00",
};

const olderUnreadAlert: DomainAlert = {
  ...unreadAlert,
  id: "7ba7b810-9dad-11d1-80b4-00c04fd430c9",
  occurrenceKey: "b",
  title: "Older alert",
  createdAt: "2026-07-13T10:00:00",
  updatedAt: "2026-07-13T10:00:00",
};

const unreadFilters = { readState: "unread" as const, severity: "all" as const };
const readFilters = { readState: "read" as const, severity: "all" as const };
const allFilters = { readState: "all" as const, severity: "all" as const };
const warningFilters = { readState: "all" as const, severity: "warning" as const };

describe("mergeReconciledAlertPage", () => {
  it("merges canonical page updates and keeps matching older rows", () => {
    const canonicalPage: DomainAlertListPage = {
      items: [unreadAlert],
      nextCursor: "cursor-page-2",
    };

    const merged = mergeReconciledAlertPage(
      [unreadAlert, olderUnreadAlert],
      canonicalPage,
      unreadFilters,
    );

    expect(merged).toEqual([unreadAlert, olderUnreadAlert]);
  });

  it("removes rows that no longer match unread filter after lifecycle change", () => {
    const canonicalPage: DomainAlertListPage = {
      items: [],
      nextCursor: null,
    };

    const merged = mergeReconciledAlertPage(
      [readAlert, olderUnreadAlert],
      canonicalPage,
      unreadFilters,
    );

    expect(merged).toEqual([olderUnreadAlert]);
  });

  it("removes rows that no longer match read filter after lifecycle change", () => {
    const canonicalPage: DomainAlertListPage = {
      items: [],
      nextCursor: null,
    };

    const merged = mergeReconciledAlertPage([unreadAlert], canonicalPage, readFilters);

    expect(merged).toEqual([]);
  });

  it("keeps updated rows under the all filter", () => {
    const canonicalPage: DomainAlertListPage = {
      items: [readAlert],
      nextCursor: null,
    };

    const merged = mergeReconciledAlertPage([unreadAlert], canonicalPage, allFilters);

    expect(merged).toEqual([readAlert]);
  });

  it("excludes rows that do not match severity filter", () => {
    const infoAlert: DomainAlert = {
      ...olderUnreadAlert,
      severity: "info",
    };
    const canonicalPage: DomainAlertListPage = {
      items: [unreadAlert],
      nextCursor: null,
    };

    const merged = mergeReconciledAlertPage(
      [unreadAlert, infoAlert],
      canonicalPage,
      warningFilters,
    );

    expect(merged).toEqual([unreadAlert]);
  });
});
