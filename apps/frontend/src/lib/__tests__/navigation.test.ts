import { describe, expect, it } from "vitest";

import { navigationItems, resolveScreenBreadcrumbs } from "../navigation";

const cashFlowNavigation = navigationItems.find((item) => item.to === "/cash-flow");

describe("resolveScreenBreadcrumbs", () => {
  it("returns a single crumb for top-level routes", () => {
    expect(resolveScreenBreadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }]);
    expect(resolveScreenBreadcrumbs("/settings")).toEqual([{ label: "Settings" }]);
  });

  it("normalizes trailing slashes", () => {
    expect(resolveScreenBreadcrumbs("/cash-flow/")).toEqual([{ label: "Cash flow" }]);
  });

  it("returns parent and current crumbs for nested routes", () => {
    expect(resolveScreenBreadcrumbs("/cash-flow/transactions")).toEqual([
      { label: "Cash flow", href: "/cash-flow" },
      { label: "Transactions" },
    ]);
  });

  it("falls back to title-cased path segments", () => {
    expect(resolveScreenBreadcrumbs("/unknown-route")).toEqual([{ label: "Unknown Route" }]);
  });
});

describe("cash flow navigation", () => {
  it("places recurring between transactions and budgets", () => {
    expect(cashFlowNavigation?.subItems?.map((item) => item.title)).toEqual([
      "Transactions",
      "Recurring",
      "Budgets",
      "Categories",
    ]);
  });
});
