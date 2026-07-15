import { expect, test } from "@playwright/test";

async function submitBudgetDialog(page: import("@playwright/test").Page, dialogName: string) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
  });
}

async function fillBudgetForm(
  page: import("@playwright/test").Page,
  dialogName: string,
  values: { name: string; allowance: string },
) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.getByLabel("Name").fill(values.name);
  await dialog.getByLabel("Monthly allowance").fill(values.allowance);
}

test("overspending an active budget emits a live critical alert with rich snapshot", async ({
  page,
}) => {
  await page.goto("/cash-flow/budgets");
  await page.getByRole("button", { name: "New budget" }).first().click();
  await fillBudgetForm(page, "New budget", {
    name: "Alert groceries",
    allowance: "100.00",
  });
  await submitBudgetDialog(page, "New budget");
  await expect(page.getByRole("link", { name: "Alert groceries" })).toBeVisible();

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: "New transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "New transaction" });
  await dialog.getByLabel("Description").fill("Overspend test");
  await dialog.getByLabel("Amount").fill("150.00");
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
  });

  await expect(page.getByText("Alert groceries is overspent")).toBeVisible({ timeout: 20_000 });

  const bell = page.getByRole("button", { name: /Alerts, 1 unread/ });
  await bell.click();
  const ledger = page.getByRole("dialog", { name: "Alerts" });
  await expect(ledger.getByText("Alert groceries is overspent")).toBeVisible();
  await expect(ledger.getByText("New")).toBeVisible();
  await expect(ledger.getByText("Effective allowance", { exact: true })).toBeVisible();
  await expect(ledger.getByText("Net budget spending", { exact: true })).toBeVisible();
  await expect(ledger.getByText("Remaining allowance", { exact: true })).toBeVisible();

  await ledger.getByRole("button", { name: "Open alert: Alert groceries is overspent" }).click();
  await expect(page.getByRole("heading", { name: "Alert groceries" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Alerts/ }).click();
  const ledgerAfterReload = page.getByRole("dialog", { name: "Alerts" });
  await expect(ledgerAfterReload.getByText("Alert groceries is overspent")).toBeVisible();
  await expect(ledgerAfterReload.getByText("New")).toHaveCount(0);
});
