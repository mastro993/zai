import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { createApiBudget } from "./recurring-production-helpers";
import {
  changeDefaultCurrency,
  createCurrencyTransaction,
  ensureCurrencyEnabled,
  ensureDefaultEur,
  openSettings,
  uniqueCategory,
} from "./currency-helpers";

const suffixOf = (testInfo: { workerIndex: number; repeatEachIndex: number; retry: number }) =>
  `${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

const pickCsv = async (page: Page, file: { name: string; content: string }) => {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Select a CSV file" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: file.name,
    mimeType: "text/csv",
    buffer: Buffer.from(file.content),
  });
};

test("currency settings add, disable, and default-change", async ({ page, request }) => {
  await openSettings(page);
  const rubRow = page.getByRole("row").filter({ hasText: /^RUB/ });
  const rubOption = page.getByRole("option", { name: /RUB / });
  if ((await rubRow.count()) === 0) {
    await page.getByLabel("Add currency").click();
    await expect(rubOption).toBeVisible();
    await rubOption.click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const disclosure = page.getByRole("dialog", { name: "Use European Central Bank rates?" });
    await expect(page.getByRole("row").filter({ hasText: /^RUB/ }).or(disclosure)).toBeVisible({
      timeout: 30_000,
    });
    if (await disclosure.isVisible()) {
      await disclosure.getByRole("button", { name: "Enable ECB rates" }).click();
    }
  }
  await expect(rubRow).toContainText("Enabled", { timeout: 30_000 });

  await rubRow.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Disable" }).click();
  await page
    .getByRole("dialog", { name: "Disable RUB?" })
    .getByRole("button", { name: "Disable" })
    .click();
  await expect(rubRow).toContainText("Disabled");

  await rubRow.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Re-enable" }).click();
  await expect(rubRow).toContainText("Enabled");

  await page.getByRole("radio", { name: "Set RUB as default currency" }).click();
  await page
    .getByRole("dialog", { name: "Use RUB as default currency?" })
    .getByRole("button", { name: "Change default" })
    .click();
  await expect(page.getByRole("radio", { name: "Set RUB as default currency" })).toBeChecked({
    timeout: 30_000,
  });
  await ensureDefaultEur(request);
});

test("transaction form remembers last-used currency and detail recovers pending rates", async ({
  page,
  request,
}, testInfo) => {
  const suffix = suffixOf(testInfo);
  await ensureCurrencyEnabled(request, "RUB");
  await ensureDefaultEur(request);
  const description = `E2E currency form ${suffix}`;

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: "New transaction", exact: true }).click();
  const createDrawer = page.getByRole("dialog", { name: "New transaction" });
  await createDrawer.getByLabel("Transaction currency").click();
  await page.getByRole("option", { name: /RUB/ }).click();
  await expect(createDrawer.getByRole("button", { name: "Adjust rate" })).toBeVisible();
  await createDrawer.getByLabel("Amount").fill("12.50");
  await createDrawer.getByLabel("Description").fill(description);
  await createDrawer.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction created")).toBeVisible();

  await page.getByRole("button", { name: "New transaction", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "New transaction" }).getByLabel("Transaction currency"),
  ).toContainText("RUB");
  await page.keyboard.press("Escape");

  const pending = await createCurrencyTransaction(request, {
    description: `E2E currency pending ${suffix}`,
    currency: "RUB",
  });
  await page.goto(`/cash-flow/transactions/${pending.id}`);
  await expect(
    page.getByText("Exchange-rate pending. Cross-currency results stay incomplete."),
  ).toBeVisible();
  await page.getByLabel("Manual recovery rate").fill("90");
  await page.getByRole("button", { name: "Enter rate" }).click();
  await expect(
    page.getByText("Exchange-rate pending. Cross-currency results stay incomplete."),
  ).toHaveCount(0);
});

test("incomplete budget period stays Incomplete with em dash amounts", async ({
  page,
  request,
}, testInfo) => {
  const suffix = suffixOf(testInfo);
  await ensureCurrencyEnabled(request, "RUB");
  await ensureDefaultEur(request);
  const category = await uniqueCategory(request, suffix);
  const budgetName = `E2E currency budget ${suffix}`;
  await createApiBudget(request, budgetName, category.id);
  await createCurrencyTransaction(request, {
    description: `E2E currency budget spend ${suffix}`,
    currency: "RUB",
    categoryId: category.id,
  });

  await page.goto("/cash-flow/budgets");
  const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: budgetName }) });
  await expect(row.getByText("Incomplete")).toBeVisible();
  await expect(row.getByText("—").first()).toBeVisible();
});

test("currencyless and currency-column imports prepare currencies", async ({
  page,
  request,
}, testInfo) => {
  const suffix = suffixOf(testInfo);
  await ensureCurrencyEnabled(request, "RUB");

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: "Import transactions" }).click();
  await pickCsv(page, {
    name: `currencyless-${suffix}.csv`,
    content: "date,amount,type,description\n2026-08-18,10.00,expense,Currencyless coffee\n",
  });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByLabel("Transaction currency")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Currencies this import will prepare")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 transactions" }).click();
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();

  await page.getByRole("button", { name: "Import transactions" }).click();
  await pickCsv(page, {
    name: `currency-column-${suffix}.csv`,
    content:
      "date,amount,currency,type,description\n2026-08-18,20.00,RUB,expense,Column ruble spend\n",
  });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Currencies this import will prepare")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 transactions" }).click();
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();
});

test("stale import preview rebuilds after a default-currency change", async ({
  page,
  request,
}, testInfo) => {
  const suffix = suffixOf(testInfo);
  await ensureCurrencyEnabled(request, "RUB");
  await changeDefaultCurrency(request, "EUR");

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: "Import transactions" }).click();
  await pickCsv(page, {
    name: `stale-preview-${suffix}.csv`,
    content: `date,amount,type,description\n2026-08-18,15.00,expense,Stale preview row ${suffix}\n`,
  });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("button", { name: "Import 1 transactions" })).toBeEnabled();

  await changeDefaultCurrency(request, "RUB");
  await page.getByRole("button", { name: "Import 1 transactions" }).click();
  const staleToast = page.getByRole("status").filter({ hasText: "Failed to import transactions" });
  await expect(staleToast).toBeVisible();
  await expect(page.getByText("Import preview is stale and must be rebuilt")).toBeVisible();
  await expect(staleToast).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Import 1 transactions" }).click();
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();
  await changeDefaultCurrency(request, "EUR");
});

test("export csv keeps source currency and rate fields", async ({ page, request }, testInfo) => {
  const suffix = suffixOf(testInfo);
  const description = `E2E currency export ${suffix}`;
  await createCurrencyTransaction(request, { description, currency: "EUR" });

  await page.addInitScript(() => {
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
  await page.goto("/cash-flow/transactions");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await readFile(downloadPath ?? "", "utf8");
  const header = csv.split("\n")[0] ?? "";
  expect(header).toContain("currency");
  expect(header).toContain("rate_variant");
  expect(header).toContain("origin");
  expect(csv).toContain(description);
});

test("refresh-failure alert opens Currency settings focused on rates", async ({ page }) => {
  const refreshAlert = {
    items: [
      {
        id: "6ba7b810-9dad-11d1-80b4-00c04fd430c9",
        producerKey: "currency.refresh.failure",
        occurrenceKey: "currency-refresh-failure",
        severity: "warning",
        title: "Exchange-rate refresh failed",
        body: "Cross-currency results are stale or incomplete until a refresh succeeds.",
        createdAt: "2026-08-18T10:00:00",
        updatedAt: "2026-08-18T10:00:00",
        readAt: null,
        resolvedAt: null,
        destination: { type: "currencySettings" },
      },
    ],
    nextCursor: null,
  };

  await page.route("**/api/alerts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(refreshAlert),
    });
  });
  await page.route("**/api/alerts/*/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...refreshAlert.items[0], readAt: "2026-08-18T11:00:00" }),
    });
  });
  await page.route("**/api/alerts/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(1),
    });
  });

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Alerts, 1 unread" }).click();
  await page.getByRole("button", { name: "Open alert: Exchange-rate refresh failed" }).click();
  await expect(page).toHaveURL(/\/settings\?focus=rates/);
  await expect(page.getByLabel("Add currency")).toBeVisible();
});
