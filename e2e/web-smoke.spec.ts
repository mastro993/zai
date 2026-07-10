import { expect, test } from "@playwright/test";

test("web mode loads Cash flow categories and persists a created category", async ({ page }) => {
  await page.goto("/cash-flow/categories");

  await expect(
    page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")),
  ).resolves.toBe(false);

  await expect(page.getByText("No categories yet")).toBeVisible();

  await page.getByRole("button", { name: "New category" }).first().click();
  await page.getByLabel("Name").fill("Groceries");
  await page.getByRole("button", { name: "Save category" }).click();

  await expect(page.getByText("Category saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Groceries" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: "Edit Groceries" })).toBeVisible();
});
