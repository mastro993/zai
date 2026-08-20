import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "zai-e2e-currency-setup-"));

export default defineConfig({
  testDir: "e2e",
  testMatch: "currency-setup.spec.ts",
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  outputDir: "test-results-currency-setup",
  passWithNoTests: true,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1421",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "cargo run -p zai-server",
      url: "http://127.0.0.1:3001/health",
      env: {
        ZAI_DATA_DIR: dataDir,
        ZAI_BIND_ADDR: "127.0.0.1:3001",
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter frontend dev:web -- --port 1421 --strictPort",
      url: "http://127.0.0.1:1421",
      env: {
        VITE_ZAI_API_ORIGIN: "http://127.0.0.1:3001",
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
