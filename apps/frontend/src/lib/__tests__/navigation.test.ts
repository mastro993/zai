import { describe, expect, it } from "vitest";

import { resolveScreenBreadcrumbs } from "../navigation";

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
