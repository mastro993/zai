import { describe, expect, it } from "vitest";

import type { Diagnostics } from "../../types/diagnostics";
import { buildDiagnosticsSummary, formatByteSize } from "../diagnostics";

const diagnostics: Diagnostics = {
  operatingSystem: "macos",
  architecture: "aarch64",
  database: {
    path: "/Users/private/Library/Application Support/zai.db",
    sizeBytes: 1_572_864,
    schemaVersion: "202608280000000001",
  },
  logs: {
    path: "/Users/private/Library/Logs/dev.fedemas.zai.app",
    sizeBytes: 2_048,
  },
};

describe("diagnostics formatting", () => {
  it("formats byte sizes with binary units", () => {
    expect(formatByteSize(1_572_864)).toBe("1.5 MB");
  });

  it("omits absolute paths from copied diagnostics", () => {
    const summary = buildDiagnosticsSummary(diagnostics, "2026.8.28.1", true);

    expect(summary).not.toContain("/Users/private");
    expect(summary).toContain("Database path: Available");
  });
});
