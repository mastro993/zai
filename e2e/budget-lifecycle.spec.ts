import { expect, test, type Locator, type Page } from "@playwright/test";

async function submitBudgetDialog(page: Page, dialogName: string) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
  });
}

async function fillBudgetForm(
  page: Page,
  dialogName: string,
  values: { name: string; allowance: string },
) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.getByLabel("Name").fill(values.name);
  await dialog.getByLabel("Allowance").fill(values.allowance);
}

async function openBudgetDetail(page: Page, name: string, reload = false) {
  const link = page.getByRole("link", { name });
  const href = await link.getAttribute("href");
  await link.click();
  if (href) {
    await page.waitForURL(`**${href}`);
  }
  if (reload) {
    await page.reload();
  }
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function clickBackToBudgets(page: Page) {
  const control = page.getByRole("button", { name: "Back to budgets" });
  await expect(control).toHaveAttribute("href", /\/cash-flow\/budgets\/?$/);
  await control.click();
}

test("web mode completes the budget lifecycle end to end", async ({ page }) => {
  const nativeButtonWarnings: Array<string> = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("expected a native <button>")) {
      nativeButtonWarnings.push(message.text());
    }
  });

  await page.goto("/cash-flow/budgets");

  await expect(
    page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")),
  ).resolves.toBe(false);

  await expect(page.getByText("No active budgets")).toBeVisible();
  await page.getByRole("button", { name: "New budget" }).first().click();
  await fillBudgetForm(page, "New budget", {
    name: "Monthly groceries",
    allowance: "1000.00",
  });
  await submitBudgetDialog(page, "New budget");
  await expect(page.getByRole("link", { name: "Monthly groceries" })).toBeVisible();

  await openBudgetDetail(page, "Monthly groceries");
  await expect(page.getByText("Effective allowance")).toBeVisible();
  await expect(page.getByText("Period history")).toBeVisible();

  await page.getByRole("button", { name: "Edit budget" }).click();
  await fillBudgetForm(page, "Edit budget", {
    name: "Updated groceries",
    allowance: "1200.00",
  });
  await submitBudgetDialog(page, "Edit budget");
  await expect(page.getByRole("heading", { name: "Updated groceries" })).toBeVisible();

  await page.getByRole("button", { name: "Pause budget" }).click();
  await expect(page.getByText("Paused ·")).toBeVisible();

  await clickBackToBudgets(page);
  await expect(page.getByText("No active budgets")).toBeVisible();
  await page.getByRole("button", { name: "Paused" }).click();
  await expect(page.getByRole("link", { name: "Updated groceries" })).toBeVisible();

  await openBudgetDetail(page, "Updated groceries", true);
  await page.getByRole("button", { name: "Resume budget" }).click();
  await expect(page.getByText("Active ·")).toBeVisible();

  await clickBackToBudgets(page);
  await page.getByRole("button", { name: "Active" }).click();
  await expect(page.getByRole("link", { name: "Updated groceries" })).toBeVisible();

  await openBudgetDetail(page, "Updated groceries", true);
  await expect(page.getByRole("cell", { name: "On track" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Delete budget" }).click();
  const deleteDialog: Locator = page.getByRole("dialog");
  await deleteDialog.getByRole("button", { name: "Delete budget" }).click();
  await expect(page.getByText("No active budgets")).toBeVisible();

  await page.reload();
  await expect(page.getByText("No active budgets")).toBeVisible();
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByRole("link", { name: "Updated groceries" })).toHaveCount(0);
  expect(nativeButtonWarnings).toEqual([]);
});
