import { expect, test } from "@playwright/test";

test("web mode loads Cash flow categories and persists a created category", async ({
  page,
}, testInfo) => {
  await page.goto("/cash-flow/categories");

  await expect(
    page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")),
  ).resolves.toBe(false);

  const categoryName = `E2E smoke category ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  await page.getByRole("button", { name: "New category" }).first().click();
  await page.getByLabel("Name").fill(categoryName);
  await page.getByRole("button", { name: "Save category" }).click();

  await expect(page.getByText("Category saved")).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${categoryName}` })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: `Edit ${categoryName}` })).toBeVisible();
});
