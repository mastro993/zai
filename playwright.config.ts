import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = process.env.ZAI_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "zai-e2e-"));
const apiBaseUrl = process.env.VITE_ZAI_API_BASE_URL ?? "http://127.0.0.1:3000/api/cash-flow";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1420",
  },
  webServer: [
    {
      command: "cargo run -p zai-server",
      url: "http://127.0.0.1:3000/health",
      env: {
        ZAI_DATA_DIR: dataDir,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter frontend dev:web",
      url: "http://127.0.0.1:1420",
      env: {
        VITE_ZAI_BUILD_TARGET: "web",
        VITE_ZAI_API_BASE_URL: apiBaseUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
