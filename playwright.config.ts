import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = process.env.ZAI_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "zai-e2e-"));
const apiOrigin = process.env.VITE_ZAI_API_ORIGIN ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1420",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  maxFailures: Number.parseInt(process.env.PLAYWRIGHT_MAX_FAILURES ?? "0", 10),
  webServer: [
    {
      command: "cargo run -p zai-server",
      url: "http://127.0.0.1:3000/health",
      env: {
        ZAI_DATA_DIR: dataDir,
        ZAI_CONFIRM_DEFAULT_CURRENCY: "EUR",
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter frontend dev:web",
      url: "http://127.0.0.1:1420",
      env: {
        VITE_ZAI_API_ORIGIN: apiOrigin,
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
