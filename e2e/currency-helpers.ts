import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { apiJson, createApiCategory, localDateTime } from "./recurring-production-helpers";

export interface CurrencyJob {
  jobId: string;
  type: string;
  status: string;
  currencyCode?: string;
}

export interface CurrencySettingsRow {
  code: string;
  status: string;
  isDefault: boolean;
}

export async function waitForCurrencyJob(
  request: APIRequestContext,
  jobId: string,
): Promise<CurrencyJob> {
  await expect
    .poll(
      async () => {
        const job = await apiJson<CurrencyJob>(request, "GET", `/api/currencies/jobs/${jobId}`);
        return job.status;
      },
      { timeout: 30_000 },
    )
    .not.toBe("running");
  const job = await apiJson<CurrencyJob>(request, "GET", `/api/currencies/jobs/${jobId}`);
  expect(job.status).toBe("succeeded");
  return job;
}

export async function ensureCurrencyEnabled(
  request: APIRequestContext,
  code: string,
): Promise<void> {
  const rows = await apiJson<Array<CurrencySettingsRow>>(request, "GET", "/api/currencies");
  const existing = rows.find((row) => row.code === code);
  if (existing?.status === "enabled") {
    return;
  }
  const job = await apiJson<CurrencyJob>(request, "POST", `/api/currencies/${code}/add`, {
    confirmProviderDisclosure: false,
  });
  if (job.status === "running") {
    await waitForCurrencyJob(request, job.jobId);
  } else {
    expect(job.status).toBe("succeeded");
  }
}

export async function changeDefaultCurrency(
  request: APIRequestContext,
  code: string,
): Promise<void> {
  const job = await apiJson<CurrencyJob>(request, "POST", "/api/currencies/default", { code });
  if (job.status === "running") {
    await waitForCurrencyJob(request, job.jobId);
  }
}

export async function ensureDefaultEur(request: APIRequestContext): Promise<void> {
  await changeDefaultCurrency(request, "EUR");
}

export async function createCurrencyTransaction(
  request: APIRequestContext,
  input: {
    description: string;
    currency: string;
    categoryId?: string | null;
    amount?: number;
  },
) {
  return apiJson<{ id: string }>(request, "POST", "/api/transactions", {
    description: input.description,
    amount: input.amount ?? 2500,
    currency: input.currency,
    transactionDate: localDateTime(0),
    transactionType: "expense",
    transactionCategoryId: input.categoryId ?? null,
    notes: null,
  });
}

export async function uniqueCategory(request: APIRequestContext, suffix: string) {
  return createApiCategory(request, `E2E currency category ${suffix}`);
}

export async function openSettings(page: Page) {
  await page.goto("/settings");
  await expect(page.getByLabel("Add currency")).toBeVisible();
}
