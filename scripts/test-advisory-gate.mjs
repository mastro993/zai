import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockingFindings } from "./advisory-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(rootDir, "test-fixtures/advisory-gate/high-severity-report.json");
const report = JSON.parse(readFileSync(fixturePath, "utf8"));

const blocking = blockingFindings(report, "HIGH");
if (blocking.length === 0) {
  console.error("expected fixture report to include a HIGH advisory");
  process.exit(1);
}

const mediumOnly = {
  results: [
    {
      packages: [
        {
          package: { name: "example" },
          vulnerabilities: [
            {
              id: "GHSA-example-medium",
              database_specific: { severity: "MEDIUM" },
            },
          ],
        },
      ],
    },
  ],
};

if (blockingFindings(mediumOnly, "HIGH").length !== 0) {
  console.error("MEDIUM advisories must not block HIGH threshold");
  process.exit(1);
}

console.log("advisory gate severity fixture checks passed");
