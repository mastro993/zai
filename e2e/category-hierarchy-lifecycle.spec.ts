import { expect, test, type Page } from "@playwright/test";

async function deleteCategoryThroughUi(page: Page, name: string, initialAction: string) {
  const deletedToast = page.getByText("Category deleted", { exact: true });
  await expect(deletedToast).toBeHidden();

  await page
    .getByRole("dialog", { name: `Delete ${name}?` })
    .getByRole("button", { name: initialAction, exact: true })
    .click();

  const continueButton = page.getByRole("button", {
    name: "Continue and delete",
    exact: true,
  });
  const recalculateButton = page.getByRole("button", {
    name: "Confirm and recalculate",
    exact: true,
  });

  await expect(continueButton.or(recalculateButton).or(deletedToast)).toBeVisible();
  if (await continueButton.isVisible()) {
    await continueButton.click();
  }

  await expect(recalculateButton.or(deletedToast)).toBeVisible();
  if (await recalculateButton.isVisible()) {
    await recalculateButton.click();
  }

  await expect(deletedToast).toBeVisible();
}

test("web mode persists category hierarchy edits and deletion through the UI", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const rootName = `E2E category root ${suffix}`;
  const updatedRootName = `E2E updated category root ${suffix}`;
  const childName = `E2E category child ${suffix}`;

  await page.goto("/cash-flow/categories");
  await page.getByRole("button", { name: "New category", exact: true }).click();

  const rootDrawer = page.getByRole("dialog", { name: "New category" });
  await rootDrawer.getByLabel("Name").fill(rootName);
  await rootDrawer.getByRole("button", { name: "Save category" }).click();

  await expect(page.getByRole("button", { name: `Edit ${rootName}` })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: `Add subcategory to ${rootName}` }).click();

  const childDrawer = page.getByRole("dialog", { name: "New subcategory" });
  await childDrawer.getByLabel("Name").fill(childName);
  await childDrawer.getByRole("button", { name: "Save category" }).click();

  await page.getByRole("button", { name: `Expand ${rootName}` }).click();
  await expect(page.getByRole("button", { name: `Edit ${childName}` })).toBeVisible();

  await page.getByRole("button", { name: `Edit ${rootName}` }).click();
  const editDrawer = page.getByRole("dialog", { name: "Edit category" });
  await editDrawer.getByLabel("Name").fill(updatedRootName);
  await editDrawer.getByRole("button", { name: "Save category" }).click();

  await expect(page.getByRole("button", { name: `Edit ${updatedRootName}` })).toBeVisible();
  await page.getByRole("button", { name: `Expand ${updatedRootName}` }).click();
  await expect(page.getByRole("button", { name: `Edit ${childName}` })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: `Expand ${updatedRootName}` }).click();
  await expect(page.getByRole("button", { name: `Edit ${childName}` })).toBeVisible();

  await page.getByRole("button", { name: `Delete ${childName}` }).click();
  await deleteCategoryThroughUi(page, childName, "Delete category");
  await expect(page.getByRole("button", { name: `Edit ${childName}` })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: `Edit ${childName}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Expand ${updatedRootName}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Edit ${updatedRootName}` })).toBeVisible();

  await page.getByRole("button", { name: `Delete ${updatedRootName}` }).click();
  await deleteCategoryThroughUi(page, updatedRootName, "Delete category");
  await expect(page.getByRole("button", { name: `Edit ${updatedRootName}` })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: `Edit ${updatedRootName}` })).toHaveCount(0);
});
