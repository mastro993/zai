import { expect, test, type Page } from "@playwright/test";

import { createApiCategory } from "./recurring-production-helpers";

const transactionSearch = (page: Page) => page.getByPlaceholder("Search description or notes...");

test("web mode persists transaction create, edit, and delete through the UI", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const category = await createApiCategory(page.request, `E2E transaction category ${suffix}`);
  const description = `E2E transaction ${suffix}`;
  const updatedDescription = `E2E updated transaction ${suffix}`;

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: "New transaction", exact: true }).click();

  const createDrawer = page.getByRole("dialog", { name: "New transaction" });
  await createDrawer.getByLabel("Amount").fill("42.50");
  await createDrawer.getByLabel("Choose category").click();
  await page
    .getByRole("dialog", { name: "Select category" })
    .getByRole("option", { name: category.name, exact: true })
    .click();
  await createDrawer.getByLabel("Description").fill(description);
  await createDrawer.getByRole("button", { name: "Save transaction" }).click();

  await expect(page.getByText("Transaction created")).toBeVisible();
  await transactionSearch(page).fill(description);
  await expect(page.getByRole("button", { name: `Edit ${description}` })).toBeVisible();

  await page.reload();
  await transactionSearch(page).fill(description);
  await page.getByRole("button", { name: `Edit ${description}` }).click();

  const editDrawer = page.getByRole("dialog", { name: "Edit transaction" });
  await editDrawer.getByRole("button", { name: "income", exact: true }).click();
  await editDrawer.getByLabel("Amount").fill("84.25");
  await editDrawer.getByLabel("Description").fill(updatedDescription);
  await editDrawer.getByRole("button", { name: "Save transaction" }).click();

  await expect(page.getByText("Transaction updated")).toBeVisible();
  await transactionSearch(page).fill(updatedDescription);
  const updatedRow = page
    .getByRole("row")
    .filter({ has: page.getByText(updatedDescription, { exact: true }) });
  await expect(updatedRow).toHaveCount(1);
  await expect(updatedRow.getByText("Income", { exact: true })).toBeVisible();
  await expect(updatedRow.getByText(category.name, { exact: true })).toBeVisible();
  await expect(updatedRow.getByText("€84.25", { exact: true })).toBeVisible();

  await page.reload();
  await transactionSearch(page).fill(updatedDescription);
  await expect(page.getByRole("button", { name: `Edit ${updatedDescription}` })).toBeVisible();

  await page.getByRole("button", { name: `Delete ${updatedDescription}` }).click();
  await page
    .getByRole("dialog", { name: "Delete transaction?" })
    .getByRole("button", { name: "Delete transaction", exact: true })
    .click();
  await expect(page.getByRole("button", { name: `Edit ${updatedDescription}` })).toHaveCount(0);

  await page.reload();
  await transactionSearch(page).fill(updatedDescription);
  await expect(page.getByRole("button", { name: `Edit ${updatedDescription}` })).toHaveCount(0);
});
