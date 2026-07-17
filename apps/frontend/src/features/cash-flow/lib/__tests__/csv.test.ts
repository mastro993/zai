import { describe, expect, it } from "vitest";

import { escapeCsvValue } from "../csv";

describe("escapeCsvValue", () => {
  it("neutralizes spreadsheet formula prefixes", () => {
    for (const prefix of ["=", "+", "-", "@", "\t", "\r", "\n", "＝", "＋", "－", "＠"]) {
      const value = `${prefix}1+1`;
      expect(escapeCsvValue(value)).toBe(`"\t${value}"`);
    }
  });

  it("preserves ordinary values and escapes CSV delimiters", () => {
    expect(escapeCsvValue("Groceries")).toBe("Groceries");
    expect(escapeCsvValue('Coffee, "special"')).toBe('"Coffee, ""special"""');
  });
});
