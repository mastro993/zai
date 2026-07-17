import { describe, expect, it } from "vitest";

import { parseImportAmount } from "../parse-import-amount";

describe("parseImportAmount", () => {
  it("parses european thousands and decimal separators", () => {
    expect(parseImportAmount("1.200,50")).toEqual({ ok: true, cents: 120050, signed: 1200.5 });
  });

  it("parses us thousands and decimal separators", () => {
    expect(parseImportAmount("1,200.50")).toEqual({ ok: true, cents: 120050, signed: 1200.5 });
  });

  it("strips currency symbols and comma decimals", () => {
    expect(parseImportAmount("€12,50")).toEqual({ ok: true, cents: 1250, signed: 12.5 });
  });

  it("parses negative signed amounts", () => {
    expect(parseImportAmount("-1.200,50")).toEqual({ ok: true, cents: 120050, signed: -1200.5 });
  });

  it("parses plain decimal amounts", () => {
    expect(parseImportAmount("12.50")).toEqual({ ok: true, cents: 1250, signed: 12.5 });
  });

  it("allows zero amounts", () => {
    expect(parseImportAmount("0")).toEqual({ ok: true, cents: 0, signed: 0 });
    expect(parseImportAmount("0,00")).toEqual({ ok: true, cents: 0, signed: 0 });
  });

  it("enforces the backend minor-unit boundary", () => {
    expect(parseImportAmount("21474836.47")).toEqual({
      ok: true,
      cents: 2147483647,
      signed: 21474836.47,
    });
    expect(parseImportAmount("21474836.48")).toEqual({
      ok: false,
      message: "Amount exceeds supported maximum",
    });
  });

  it("rejects unbalanced accounting parentheses", () => {
    for (const amount of ["(12.50", "12.50)"]) {
      expect(parseImportAmount(amount)).toEqual({ ok: false, message: "Invalid amount" });
    }
  });
});
