import { expect, test } from "@playwright/test";

const apiOrigin = "http://127.0.0.1:3001";

test("currency-initial-setup confirms locale suggestion and unblocks money writes", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Choose your default currency" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

  const blocked = await request.fetch(`${apiOrigin}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: {
      description: "Blocked before setup",
      amount: 100,
      currency: "EUR",
      transactionDate: "2026-08-18T12:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
    },
  });
  expect(blocked.status()).toBe(409);
  expect(await blocked.text()).toContain("setupRequired");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Choose your default currency" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);

  const created = await request.fetch(`${apiOrigin}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: {
      description: "Unblocked after setup",
      amount: 100,
      currency: "EUR",
      transactionDate: "2026-08-18T12:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
});
