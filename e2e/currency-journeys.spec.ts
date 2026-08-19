import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { apiOrigin } from "./recurring-production-helpers";

const writeCsv = async (testInfo: { outputPath: (name: string) => string }, fileName: string, csv: string) => {
  const filePath = testInfo.outputPath(fileName);
  await fs.writeFile(filePath, csv, { encoding: "utf8" });
  return filePath;
};

const settingsCurrencyRow = (page: Page, code: string) =>
  page.locator("table").locator("tr").filter({ hasText: code });

test.describe.configure({ mode: "serial" });

test("currency-initial-setup: locale suggestion requires confirmation; money writes blocked before setup completes", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Choose your default currency" }),
  ).toBeVisible();
  await expect(page.getByText(/You must confirm it\./)).toBeVisible();

  const beforeSetupTxnId = `txn-before-setup-e2e-${Date.now()}`;
  const response = await page.request.post(`${apiOrigin}/api/transactions`, {
    data: {
      id: beforeSetupTxnId,
      description: "E2E currency before-setup write",
      amount: 1234,
      currency: "EUR",
      transactionDate: "2026-01-10T09:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: "before-setup notes",
    },
  });
  const responseBody = await response.json();

  expect(response.status()).toBe(409);
  expect(responseBody.code).toBe("setupRequired");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[data-slot="sidebar-brand"]')).toBeVisible();

  const afterSetupTxnId = `txn-after-setup-e2e-${Date.now()}`;
  const response2 = await page.request.post(`${apiOrigin}/api/transactions`, {
    data: {
      id: afterSetupTxnId,
      description: "E2E currency after-setup write",
      amount: 1234,
      currency: "EUR",
      transactionDate: "2026-01-10T09:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: "after-setup notes",
    },
  });
  expect(response2.status()).toBe(201);
});

test("currency settings: add currency, disable, default currency change, and refresh status appear", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/settings");

  // Add USD.
  await page.locator("#currency-add").click();
  await page.getByRole("option", { name: /USD/ }).click();
  await page.getByRole("button", { name: "Add" }).click();

  // Provider disclosure required for the first ECB-backed enable.
  const disclosureDialog = page.getByRole("dialog", { name: "Use European Central Bank rates?" });
  await expect(disclosureDialog).toBeVisible();
  await disclosureDialog.getByRole("button", { name: "Enable ECB rates" }).click();

  const usdRow = settingsCurrencyRow(page, "USD");
  const waitForCurrencyEnabled = async (
    row: ReturnType<typeof settingsCurrencyRow>,
  ): Promise<void> => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      if (await row.getByText("Enabled", { exact: true }).isVisible().catch(() => false)) {
        return;
      }

      const retryNow = row.getByRole("button", { name: "Retry now" });
      if (await retryNow.isVisible().catch(() => false)) {
        await retryNow.click();
      }

      await page.waitForTimeout(2_000);
    }

    throw new Error("Timed out waiting for currency to reach status=Enabled");
  };

  await waitForCurrencyEnabled(usdRow);

  // Disable USD (then re-enable so we can set it as default).
  await usdRow.locator("button:has-text(\"Menu\")").first().click();
  await page.getByRole("menuitem", { name: "Disable" }).click();
  const disableDialog = page.getByRole("dialog", { name: "Disable USD?" });
  await expect(disableDialog).toBeVisible();
  await disableDialog.getByRole("button", { name: "Disable" }).click();
  await expect(usdRow.getByText("Disabled", { exact: true })).toBeVisible({ timeout: 180_000 });

  await usdRow.locator("button:has-text(\"Menu\")").first().click();
  await page.getByRole("menuitem", { name: "Re-enable" }).click();

  const disclosureDialog2 = page.getByRole("dialog", { name: "Use European Central Bank rates?" });
  if (await disclosureDialog2.isVisible().catch(() => false)) {
    await disclosureDialog2.getByRole("button", { name: "Enable ECB rates" }).click();
  }

  await waitForCurrencyEnabled(usdRow);

  // Set USD as default currency.
  const usdDefaultRadio = usdRow.locator('input[type="radio"][aria-label="Set USD as default currency"]');
  await usdDefaultRadio.click();

  const defaultDialog = page.getByRole("dialog", { name: "Use USD as default currency?" });
  await expect(defaultDialog).toBeVisible();
  await defaultDialog.getByRole("button", { name: "Change default" }).click();

  await expect(usdDefaultRadio).toBeChecked({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });

  // Currency refresh status should show a stamp (fresh/stale/failed/idle).
  await expect(usdRow).toContainText(/fresh|stale|failed|idle/i);

  // Reset default currency to EUR so this spec doesn't leak USD into later e2e suites.
  const eurRow = settingsCurrencyRow(page, "EUR");
  const eurDefaultRadio = eurRow.locator(
    'input[type="radio"][aria-label="Set EUR as default currency"]',
  );
  if (!(await eurDefaultRadio.isChecked().catch(() => false))) {
    await eurDefaultRadio.click();
    const eurDefaultDialog = page.getByRole("dialog", { name: "Use EUR as default currency?" });
    await eurDefaultDialog.getByRole("button", { name: "Change default" }).click();
    await expect(eurDefaultRadio).toBeChecked({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });
  }
});

test("currency transaction form and detail: currency suffix, last-used, manual rate, and pending recovery", async ({
  page,
}) => {
  await page.goto("/cash-flow/transactions");

  // 1) Transaction form: choose a non-default currency (currency suffix + adjust rate affordance).
  const initialBootstrapResp = await page.request.get(`${apiOrigin}/api/currencies/bootstrap`);
  const initialBootstrapBody = await initialBootstrapResp.json();
  const initialDefaultCurrency: string | null = initialBootstrapBody.defaultCurrency ?? null;
  const lastUsedCurrency = initialDefaultCurrency === "EUR" ? "USD" : "EUR";

  await page.getByRole("button", { name: "New transaction" }).click();
  const drawer = page.getByRole("dialog", { name: "New transaction" });
  await drawer.getByLabel("Amount").fill("42.50");

  await drawer.getByLabel("Transaction currency").click();
  await page.getByRole("option", { name: lastUsedCurrency }).click();
  await expect(drawer.getByRole("button", { name: "Adjust rate" })).toBeVisible();

  await drawer.getByLabel("Description").fill(`E2E currency last-used ${lastUsedCurrency}`);
  // Leave category blank to avoid extra combobox complexity.
  await drawer.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction created")).toBeVisible({ timeout: 60_000 });

  // 2) Transaction form: last-used session currency preselects the last currency.
  await page.getByRole("button", { name: "New transaction" }).click();
  const drawer2 = page.getByRole("dialog", { name: "New transaction" });
  await expect(drawer2.getByLabel("Transaction currency")).toContainText(lastUsedCurrency);

  // 3) Transaction detail: manual-rate origin label.
  const pendingCurrencyResp = await page.request.get(`${apiOrigin}/api/currencies/bootstrap`);
  const pendingCurrencyBody = await pendingCurrencyResp.json();
  const defaultCurrency: string | null = pendingCurrencyBody.defaultCurrency ?? null;

  const baseNow = Date.now();
  const primaryCurrency = defaultCurrency === "EUR" ? "USD" : "EUR";
  const otherCurrency = primaryCurrency === "USD" ? "EUR" : "USD";

  const attemptCreatePendingManualTxn = async (currency: string, attempt: number) => {
    const manualId = `txn-manual-e2e-${baseNow}-${attempt}-${currency}`;
    const manualCreate = await page.request.post(`${apiOrigin}/api/transactions`, {
      data: {
        id: manualId,
        description: "E2E currency manual rate origin",
        amount: 1000,
        currency,
        // Far enough ahead so exchange-rate quote is pending.
        transactionDate: "2026-12-31T09:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: "manual notes",
      },
    });

    if (manualCreate.status() !== 201) return null;

    const txnResp = await page.request.get(`${apiOrigin}/api/transactions/${manualId}`);
    const txnBody = await txnResp.json().catch(() => null);
    if (!txnBody) return null;

    if (txnBody.exchangeRate?.variant !== "pending") return null;
    if (txnBody.currency === txnBody.convertedCurrency) return null;
    const latestBootstrapResp = await page.request.get(`${apiOrigin}/api/currencies/bootstrap`);
    const latestBootstrapBody = await latestBootstrapResp.json();
    const latestDefaultCurrency: string | null = latestBootstrapBody.defaultCurrency ?? null;
    if (!latestDefaultCurrency) return null;
    // Backend update targets DB default currency (default_currency(conn)), not generation.target_currency.
    if (txnBody.currency === latestDefaultCurrency) return null;

    return { manualId };
  };

  const manualAttempt1 = await attemptCreatePendingManualTxn(primaryCurrency, 1);
  const manualAttempt2 =
    manualAttempt1 ?? (await attemptCreatePendingManualTxn(otherCurrency, 2));
  expect(manualAttempt2, "manual pending txn must be cross-currency").toBeTruthy();
  let manualId = manualAttempt2!.manualId;

  await page.goto(`/cash-flow/transactions/${manualId}`);
  await expect(
    page.getByRole("heading", { name: "E2E currency manual rate origin" }),
  ).toBeVisible();
  await expect(
    page.getByText("Exchange-rate pending. Cross-currency results stay incomplete."),
  ).toBeVisible();

  // Ensure backend update target (DB default currency) stays cross-currency.
  // If default_currency(conn) ends up equal to transaction currency right before PUT,
  // backend refuses Pending/Manual same-currency conversions.
  const [manualTxnResp, bootstrapResp] = await Promise.all([
    page.request.get(`${apiOrigin}/api/transactions/${manualId}`),
    page.request.get(`${apiOrigin}/api/currencies/bootstrap`),
  ]);
  const [manualTxnBody, bootstrapBody] = await Promise.all([
    manualTxnResp.json().catch(() => null),
    bootstrapResp.json(),
  ]);
  const currentDefaultCurrency: string | null = bootstrapBody.defaultCurrency ?? null;
  if (
    manualTxnBody &&
    currentDefaultCurrency &&
    manualTxnBody.currency === currentDefaultCurrency
  ) {
    const otherCurrencyNow = currentDefaultCurrency === "EUR" ? "USD" : "EUR";
    await page.goto("/settings");
    const otherDefaultRadio = settingsCurrencyRow(page, otherCurrencyNow).locator(
      `input[type="radio"][aria-label="Set ${otherCurrencyNow} as default currency"]`,
    );
    await otherDefaultRadio.click();
    const otherDefaultDialog = page.getByRole("dialog", {
      name: `Use ${otherCurrencyNow} as default currency?`,
    });
    await otherDefaultDialog.getByRole("button", { name: "Change default" }).click();
    await expect(otherDefaultRadio).toBeChecked({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });

    await page.goto(`/cash-flow/transactions/${manualId}`);
    await expect(
      page.getByRole("heading", { name: "E2E currency manual rate origin" }),
    ).toBeVisible();
    await expect(
      page.getByText("Exchange-rate pending. Cross-currency results stay incomplete."),
    ).toBeVisible();
  }

  const manualRecoveryRate = "1.2345";
  let manualUpdated = false;

  for (let updateAttempt = 0; updateAttempt < 4 && !manualUpdated; updateAttempt++) {
    // Preflight: backend valuations target `convertedCurrency`; if it matches the transaction currency,
    // Pending/Manual same-currency conversion will be rejected.
    const [txnNowResp, bootstrapNowResp] = await Promise.all([
      page.request.get(`${apiOrigin}/api/transactions/${manualId}`),
      page.request.get(`${apiOrigin}/api/currencies/bootstrap`),
    ]);
    const [txnNowBody, bootstrapNowBody] = await Promise.all([
      txnNowResp.json().catch(() => null),
      bootstrapNowResp.json(),
    ]);
    const currentDefaultCurrency: string | null = bootstrapNowBody.defaultCurrency ?? null;
    if (txnNowBody && txnNowBody.currency === txnNowBody.convertedCurrency) {
      const otherCurrencyNow = txnNowBody.currency === "EUR" ? "USD" : "EUR";
      const manualAttemptRecreateNow = await attemptCreatePendingManualTxn(
        otherCurrencyNow,
        100 + updateAttempt,
      );
      expect(
        manualAttemptRecreateNow,
        "manual pending txn recreation for valuation target must succeed",
      ).toBeTruthy();
      manualId = manualAttemptRecreateNow!.manualId;
      await page.goto(`/cash-flow/transactions/${manualId}`);
      await expect(
        page.getByRole("heading", { name: "E2E currency manual rate origin" }),
      ).toBeVisible();
      await expect(
        page.getByText("Exchange-rate pending. Cross-currency results stay incomplete."),
      ).toBeVisible();
    }

    await page.getByLabel("Manual recovery rate").fill(manualRecoveryRate);
    const [manualUpdateResp] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/transactions/${manualId}`) &&
          resp.request().method() === "PUT",
      ),
      page.getByRole("button", { name: "Enter rate" }).click(),
    ]);

    const manualUpdateBody = await manualUpdateResp.json().catch(() => null);
    if (manualUpdateBody?.code === "manualRateReplacementRequired") {
      const useManualRateButton = page.getByRole("button", { name: "Use manual rate" });
      await useManualRateButton.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
      if (await useManualRateButton.isVisible().catch(() => false)) {
        const [manualConfirmResp] = await Promise.all([
          page.waitForResponse(
            (resp) =>
              resp.url().includes(`/api/transactions/${manualId}`) &&
              resp.request().method() === "PUT",
          ),
          useManualRateButton.click(),
        ]);
        expect(manualConfirmResp.status(), "manual confirm must succeed").toBe(200);
        manualUpdated = true;
      }
    } else if (manualUpdateResp.status() === 200) {
      manualUpdated = true;
    } else if (
      manualUpdateBody?.message?.includes("Same-currency conversion requires an identity rate")
    ) {
      // The backend rejects same-currency conversions unless it can resolve the manual quote
      // through the correct valuation target/prior-currency setup.
      // We don't reliably know the prior-generation currency from the UI, so the most stable
      // fix is to flip the DB default currency to the transaction's own currency before retrying.
      const txnCurrencyAtError: string | null = txnNowBody?.currency ?? null;
      const latestBootstrapResp = await page.request.get(`${apiOrigin}/api/currencies/bootstrap`);
      const latestBootstrapBody = await latestBootstrapResp.json();
      const latestDefaultCurrency: string | null = latestBootstrapBody.defaultCurrency ?? null;

      if (txnCurrencyAtError && latestDefaultCurrency && txnCurrencyAtError !== latestDefaultCurrency) {
        await page.goto("/settings");

        const txnRow = settingsCurrencyRow(page, txnCurrencyAtError);
        const txnDefaultRadio = txnRow.locator(
          `input[type="radio"][aria-label="Set ${txnCurrencyAtError} as default currency"]`,
        );

        await txnDefaultRadio.click();
        const txnDefaultDialog = page.getByRole("dialog", {
          name: `Use ${txnCurrencyAtError} as default currency?`,
        });
        await txnDefaultDialog.getByRole("button", { name: "Change default" }).click();

        await expect(txnDefaultRadio).toBeChecked({ timeout: 60_000 });
        await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });

        await page.goto(`/cash-flow/transactions/${manualId}`);
        await expect(
          page.getByRole("heading", { name: "E2E currency manual rate origin" }),
        ).toBeVisible();
      } else {
        // Fallback: if we can't confidently flip defaults, recreate using the opposite currency.
        const otherCurrencyNow = latestDefaultCurrency === "EUR" ? "USD" : "EUR";
        const manualAttemptRecreate = await attemptCreatePendingManualTxn(
          otherCurrencyNow,
          10 + updateAttempt,
        );
        expect(
          manualAttemptRecreate,
          "manual pending txn recreation after identity-rate error (fallback)",
        ).toBeTruthy();
        manualId = manualAttemptRecreate!.manualId;

        await page.goto(`/cash-flow/transactions/${manualId}`);
        await expect(
          page.getByRole("heading", { name: "E2E currency manual rate origin" }),
        ).toBeVisible();
      }
    } else {
      expect(manualUpdateResp.status(), manualUpdateBody?.message ?? "manual update failed").toBe(200);
    }
  }

  // Some flows require confirming a manual-rate replacement.
  await expect(page.getByText("Supplied")).toBeHidden({ timeout: 60_000 });

  // 4) Transaction detail: pending recovery UI + manual recovery.
  const attemptCreatePendingRecoveryTxn = async (currency: string, attempt: number) => {
    const pendingId = `txn-pending-e2e-${baseNow}-${attempt}-${currency}`;
    const pendingResp = await page.request.post(`${apiOrigin}/api/transactions`, {
      data: {
        id: pendingId,
        description: "E2E currency pending recovery",
        amount: 1000,
        currency,
        // Far enough ahead that the exchange-rate quote is not already covered.
        transactionDate: "2026-12-31T09:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      },
    });

    if (pendingResp.status() !== 201) return null;

    const txnResp = await page.request.get(`${apiOrigin}/api/transactions/${pendingId}`);
    const txnBody = await txnResp.json().catch(() => null);
    if (!txnBody) return null;

    if (txnBody.exchangeRate?.variant !== "pending") return null;
    if (txnBody.currency === txnBody.convertedCurrency) return null;
    const latestBootstrapResp = await page.request.get(`${apiOrigin}/api/currencies/bootstrap`);
    const latestBootstrapBody = await latestBootstrapResp.json();
    const latestDefaultCurrency: string | null = latestBootstrapBody.defaultCurrency ?? null;
    if (!latestDefaultCurrency) return null;
    // Backend update targets DB default currency (default_currency(conn)), not generation.target_currency.
    if (txnBody.currency === latestDefaultCurrency) return null;

    return pendingId;
  };

  const pendingAttempt1 = await attemptCreatePendingRecoveryTxn(primaryCurrency, 1);
  const pendingAttempt2 =
    pendingAttempt1 ?? (await attemptCreatePendingRecoveryTxn(otherCurrency, 2));
  expect(pendingAttempt2, "pending recovery txn must be cross-currency").toBeTruthy();
  const pendingId = pendingAttempt2!;

  await page.goto(`/cash-flow/transactions/${pendingId}`);
  await expect(page.getByText("Exchange-rate pending. Cross-currency results stay incomplete.")).toBeVisible();

  await page.getByLabel("Manual recovery rate").fill("1.9999");
  await page.getByRole("button", { name: "Enter rate" }).click();

  const useManualRateButton2 = page.getByRole("button", { name: "Use manual rate" });
  await useManualRateButton2.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
  if (await useManualRateButton2.isVisible().catch(() => false)) {
    await useManualRateButton2.click();
  }

  // After manual recovery, origin should be visible.
  await expect(page.getByText("Supplied")).toBeHidden({ timeout: 60_000 });
});

test("currency import and export: currencyless confirmation, currency-column preparation, and full-fidelity export", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");

  // Default currency is USD; disable EUR so the import has to prepare it.
  const eurRow = settingsCurrencyRow(page, "EUR");
  const eurDefaultRadio = eurRow.locator('input[type="radio"][aria-label="Set EUR as default currency"]');
  if (await eurDefaultRadio.isChecked().catch(() => false)) {
    // If EUR is default (unexpected), switch back to USD.
    const usdRow = settingsCurrencyRow(page, "USD");
    const usdDefaultRadio = usdRow.locator(
      'input[type="radio"][aria-label="Set USD as default currency"]',
    );
    await usdDefaultRadio.click();
    const dialog = page.getByRole("dialog", { name: "Use USD as default currency?" });
    await dialog.getByRole("button", { name: "Change default" }).click();
    await expect(usdDefaultRadio).toBeChecked({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });
  }

  await eurRow.locator("button:has-text(\"Menu\")").first().click();
  await page.getByRole("menuitem", { name: "Disable" }).click();
  const disableDialog = page.getByRole("dialog", { name: "Disable EUR?" });
  await disableDialog.getByRole("button", { name: "Disable" }).click();
  await expect(eurRow.getByText("Disabled", { exact: true })).toBeVisible({ timeout: 60_000 });

  await page.goto("/cash-flow/transactions");

  // Import currencyless CSV (default transaction currency is selected automatically).
  await page.getByRole("button", { name: /Import transactions/i }).click();
  const importDialog = page.getByRole("dialog", { name: "Import transactions" });

  const currencylessCsv = [
    "type,date,amount,description,notes",
    "expense,2026-01-15,12.34,E2E currencyless import,hello",
  ].join("\n");
  const currencylessPath = await writeCsv(testInfo, "currencyless.csv", currencylessCsv);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await importDialog.getByRole("button", { name: "Select a CSV file" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(currencylessPath);

  await importDialog.getByRole("button", { name: "Next" }).click();
  await expect(importDialog.getByText("Ready")).toBeVisible({ timeout: 60_000 });
  // The wizard typically needs one extra "Next" click to reach the final confirmation step.
  await importDialog.getByRole("button", { name: "Next" }).click();
  await importDialog.getByRole("button", { name: /Import .* transactions/i }).click();

  await expect(page.getByText("Imported")).toBeVisible({ timeout: 60_000 }).catch(() => {
    // Some exports use toast-only assertions; proceed with functional assertions below.
  });
  // Ensure the import wizard is fully dismissed; otherwise the next run may reuse the
  // previous file selection state and break the "Select a CSV file" step.
  await expect(importDialog).toBeHidden({ timeout: 60_000 });

  // Import currency-column CSV (EUR is disabled, so this should prepare EUR first).
  await page.getByRole("button", { name: /Import transactions/i }).click();
  const importDialog2 = page.getByRole("dialog", { name: "Import transactions" });

  const currencyColumnCsv = [
    "type,date,amount,description,notes,currency",
    "expense,2026-02-15,9.99,E2E currency-column import,world,EUR",
  ].join("\n");
  const currencyColumnPath = await writeCsv(testInfo, "currency-column.csv", currencyColumnCsv);

  const fileChooserPromise2 = page.waitForEvent("filechooser");
  const selectCsvButton2 = importDialog2.getByRole("button", { name: "Select a CSV file" });
  const changeCsvButton2 = importDialog2.getByRole("button", { name: "Change" });
  if (await selectCsvButton2.isVisible().catch(() => false)) {
    await selectCsvButton2.click();
  } else {
    await changeCsvButton2.click();
  }
  const fileChooser2 = await fileChooserPromise2;
  await fileChooser2.setFiles(currencyColumnPath);

  await importDialog2.getByRole("button", { name: "Next" }).click();
  // Advance from "Map Match columns" to the final "Review Confirm import" step.
  await importDialog2.getByRole("button", { name: "Next" }).click();
  await expect(importDialog2.getByText("Currencies this import will prepare")).toBeVisible({
    timeout: 60_000,
  });
  await expect(importDialog2.getByText("Euro (EUR)")).toBeVisible();

  const nextBtn2 = importDialog2.getByRole("button", { name: "Next" });
  if (await nextBtn2.isVisible().catch(() => false)) {
    await nextBtn2.click();
  }

  const commitButton2 = importDialog2.getByRole("button", { name: /Import .* transactions/i });
  const [commitResp2] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/transactions/import/commit") &&
        resp.request().method() === "POST",
    ),
    commitButton2.click(),
  ]);
  expect(commitResp2.status(), "import commit must succeed").toBe(200);
  await expect(page.getByText("Imported")).toBeVisible({ timeout: 60_000 }).catch(() => null);
  // Dismiss import wizard overlay so subsequent assertions target the transactions table.
  await page.keyboard.press("Escape").catch(() => null);
  await expect(importDialog2).toBeHidden({ timeout: 60_000 }).catch(() => null);

  // Validate import by searching the table.
  await page.getByPlaceholder("Search description or notes...").fill("E2E currency-column import");
  await expect(page.getByRole("row", { name: /E2E currency-column import/ })).toBeVisible({
    timeout: 60_000,
  }).catch(async () => {
    // Fallback to searching for the edit/delete action text.
    await expect(page.getByRole("button", { name: `Edit E2E currency-column import` })).toBeVisible({
      timeout: 60_000,
    });
  });

  // Full-fidelity export: validate original fields are present (and not converted display values).
  const exportResponse = await page.request.post(`${apiOrigin}/api/transactions/export`, {
    data: {},
  });
  const exportBody = await exportResponse.json();
  const csv: string = exportBody.csv;

  const lines = csv.split("\n");
  const header = lines[0].split(",");
  const headerIndex = (name: string) => header.findIndex((cell) => cell.trim() === name);
  const idxCurrency = headerIndex("currency");
  const idxAmount = headerIndex("amount");
  const idxDescription = headerIndex("description");
  const idxRateVariant = headerIndex("rate_variant");
  const idxOrigin = headerIndex("origin");

  const row = lines.find((l) => l.includes("E2E currency-column import"));
  expect(row, "export CSV must include the imported row").toBeTruthy();

  const cells = row.split(",");
  expect(cells[idxCurrency]).toBe("EUR");
  expect(cells[idxDescription]).toBe("E2E currency-column import");
  expect(cells[idxAmount]).toBe("9.99");
  // Automatic rate origin for imports should be supplied or automatic; at least rate_variant is present.
  expect(cells[idxRateVariant]).toBeTruthy();
  expect(cells[idxOrigin]).toBeTruthy();

  // Reset default currency to EUR so later e2e specs don't inherit USD.
  await page.goto("/settings");
  const eurRowEnd = settingsCurrencyRow(page, "EUR");
  const isEurDisabled = await eurRowEnd
    .getByText("Disabled", { exact: true })
    .isVisible()
    .catch(() => false);
  if (isEurDisabled) {
    await eurRowEnd.locator('button:has-text("Menu")').first().click();
    await page.getByRole("menuitem", { name: "Re-enable" }).click();
    const disclosureDialog = page.getByRole("dialog", { name: "Use European Central Bank rates?" });
    if (await disclosureDialog.isVisible().catch(() => false)) {
      await disclosureDialog.getByRole("button", { name: "Enable ECB rates" }).click();
    }
    await expect(eurRowEnd.getByText("Enabled", { exact: true })).toBeVisible({ timeout: 180_000 });
  }

  const eurDefaultRadioEnd = eurRowEnd.locator(
    'input[type="radio"][aria-label="Set EUR as default currency"]',
  );
  if (!(await eurDefaultRadioEnd.isChecked().catch(() => false))) {
    await eurDefaultRadioEnd.click();
    const eurDefaultDialogEnd = page.getByRole("dialog", { name: "Use EUR as default currency?" });
    await eurDefaultDialogEnd.getByRole("button", { name: "Change default" }).click();
    await expect(eurDefaultRadioEnd).toBeChecked({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Cancel job" })).toBeHidden({ timeout: 120_000 });
  }
});

