import { describe, expect, it } from "vitest";

import {
  isSettingsPath,
  navigationItems,
  resolveScreenBreadcrumbs,
  settingsGroups,
} from "../navigation";

const cashFlowNavigation = navigationItems.find((item) => item.to === "/cash-flow");

describe("resolveScreenBreadcrumbs", () => {
  it("returns a single crumb for top-level routes", () => {
    expect(resolveScreenBreadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }]);
    expect(resolveScreenBreadcrumbs("/settings")).toEqual([{ label: "Settings" }]);
  });

  it("returns settings section crumbs under Settings", () => {
    expect(resolveScreenBreadcrumbs("/settings/appearance")).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "Appearance" },
    ]);
    expect(resolveScreenBreadcrumbs("/settings/currencies")).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "Currencies" },
    ]);
    expect(resolveScreenBreadcrumbs("/settings/about")).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "About" },
    ]);
    expect(resolveScreenBreadcrumbs("/settings/diagnostics")).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "Diagnostics" },
    ]);
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

  it("keeps transaction detail breadcrumbs human-readable", () => {
    expect(resolveScreenBreadcrumbs("/cash-flow/transactions/txn-generated")).toEqual([
      { label: "Cash flow", href: "/cash-flow" },
      { label: "Transactions", href: "/cash-flow/transactions" },
      { label: "Transaction" },
    ]);
  });

  it("falls back to title-cased path segments", () => {
    expect(resolveScreenBreadcrumbs("/unknown-route")).toEqual([{ label: "Unknown Route" }]);
  });
});

describe("isSettingsPath", () => {
  it("matches settings home and section paths", () => {
    expect(isSettingsPath("/settings")).toBe(true);
    expect(isSettingsPath("/settings/")).toBe(true);
    expect(isSettingsPath("/settings/appearance")).toBe(true);
    expect(isSettingsPath("/settings/currencies")).toBe(true);
    expect(isSettingsPath("/settings/about")).toBe(true);
    expect(isSettingsPath("/settings/diagnostics")).toBe(true);
    expect(isSettingsPath("/dashboard")).toBe(false);
    expect(isSettingsPath("/settings-room")).toBe(false);
  });
});

describe("settings groups", () => {
  it("places settings in their groups", () => {
    expect(
      settingsGroups.map((group) => ({
        label: group.label,
        titles: group.items.map((item) => item.title),
      })),
    ).toEqual([
      { label: "General", titles: ["Appearance"] },
      { label: "Finance", titles: ["Currencies"] },
      { label: "Other", titles: ["About", "Diagnostics"] },
    ]);
  });
});

describe("cash flow navigation", () => {
  it("places forecast between recurring and categories", () => {
    expect(cashFlowNavigation?.subItems?.map((item) => item.title)).toEqual([
      "Transactions",
      "Budgets",
      "Recurring",
      "Forecast",
      "Categories",
    ]);
  });

  it("resolves forecast breadcrumbs", () => {
    expect(resolveScreenBreadcrumbs("/cash-flow/forecast")).toEqual([
      { label: "Cash flow", href: "/cash-flow" },
      { label: "Forecast" },
    ]);
  });
});
