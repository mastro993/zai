import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../package.json",
);
const parsedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
// SAFETY: frontend package.json is a JSON object with a string scripts map.
const frontendPackage = parsedPackage as { scripts: Record<string, string> };

const unixEnvAssignment = /(?:^|&&\s*)[A-Z_][A-Z0-9_]*=/;

describe("frontend package scripts", () => {
  it("avoids Unix-only env assignment so Windows cmd can run them", () => {
    for (const [name, script] of Object.entries(frontendPackage.scripts)) {
      expect(script, name).not.toMatch(unixEnvAssignment);
    }
  });
});
