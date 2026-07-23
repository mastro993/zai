import { expect, test, type Page } from "@playwright/test";

const apiOrigin = process.env.VITE_ZAI_API_ORIGIN ?? "http://127.0.0.1:3000";

const localDateTimeDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:00`,
  ].join("T");
};

async function openRecurringDocument(page: Page, description: string) {
  await page.getByRole("link", { name: description }).click();
  await expect(page).toHaveURL(/\/cash-flow\/recurring\/[^/]+$/);
  await expect(page.getByRole("heading", { name: description })).toBeVisible();
}

async function waitForLinkedOccurrence(page: Page) {
  const links = page.getByRole("link", { name: /Open transactions list for occurrence/ });
  await expect
    .poll(
      async () => {
        if ((await links.count()) === 0) {
          await page.reload();
        }
        return links.count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  return links.first();
}

async function confirmLifecycle(page: Page, action: "Pause" | "Resume" | "Stop") {
  await page.getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`${action} this recurring`) });
  await dialog.getByRole("button", { name: action, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("web recurring journey persists generated links, edits, lifecycle, and navigation", async ({
  page,
}) => {
  await page.goto("/cash-flow/recurring");
  await expect(page.getByRole("heading", { name: "Recurring transactions" })).toBeVisible();
  await expect(
    page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")),
  ).resolves.toBe(false);

  const description = "E2E monthly rent";
  await page.getByRole("button", { name: "New recurring" }).click();
  const createDrawer = page.getByRole("dialog", { name: "New recurring transaction" });
  await createDrawer.getByLabel("Description").fill(description);
  await createDrawer.getByLabel("Amount").fill("1200.00");
  await createDrawer.getByLabel("First occurrence").fill(localDateTimeDaysAgo(30).slice(0, 16));
  await createDrawer.getByRole("button", { name: "Finite", exact: true }).click();
  await createDrawer.getByLabel("Number of occurrences").fill("3");
  await createDrawer.getByRole("button", { name: "Create recurring transaction" }).click();

  await expect(page.getByRole("link", { name: description })).toBeVisible();
  await openRecurringDocument(page, description);
  const generatedLink = await waitForLinkedOccurrence(page);
  await expect(page.getByText("Generated").first()).toBeVisible();

  await page.getByRole("button", { name: "Edit recurring transaction" }).click();
  const editDrawer = page.getByRole("dialog", { name: "Edit recurring transaction" });
  await editDrawer.getByLabel("Amount").fill("1250.00");
  await editDrawer.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator("dt").filter({ hasText: "Amount" }).locator("..").locator("dd"),
  ).toHaveText(/1[,.]250/);

  await confirmLifecycle(page, "Pause");
  await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
  await confirmLifecycle(page, "Resume");
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await confirmLifecycle(page, "Stop");
  await expect(page.getByText("Stopped", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename" })).toBeVisible();

  await generatedLink.click();
  await expect(page).toHaveURL(/\/cash-flow\/transactions\/?$/);
});

test("web adoption previews catch-up and preserves adopted provenance", async ({ page }) => {
  const transactionId = "e2e-adoption-transaction";
  const description = "E2E adopted transaction";
  const seed = await page.request.post(`${apiOrigin}/api/cash-flow/transactions`, {
    data: {
      id: transactionId,
      description,
      amount: 5000,
      transactionDate: localDateTimeDaysAgo(30),
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
    },
  });
  expect(seed.ok()).toBeTruthy();

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: `Adopt ${description} as recurring` }).click();
  const drawer = page.getByRole("dialog", { name: "Adopt as recurring" });
  await drawer.getByRole("button", { name: "day", exact: true }).click();
  await drawer.getByRole("button", { name: "Finite", exact: true }).click();
  await drawer.getByLabel("Number of occurrences").fill("3");
  await expect(drawer.getByText(/catch up/)).toBeVisible();
  await drawer.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(page.getByText("Recurring transaction adopted")).toBeVisible();

  await page.goto("/cash-flow/recurring");
  await openRecurringDocument(page, description);
  const adoptedLink = await waitForLinkedOccurrence(page);
  await expect(page.getByText("Adopted").first()).toBeVisible();
  await expect(adoptedLink).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: description })).toBeVisible();
});

test("web forecast board exposes a keyboard-operable empty state", async ({ page }) => {
  await page.goto("/cash-flow/forecast");
  await expect(page.getByRole("heading", { name: "Forecast" })).toBeVisible();
  await expect(page.getByLabel("Horizon")).toBeVisible();
  await expect(page.getByText("Forecast ready").first()).toBeVisible();

  const emptyState = page.getByText("No forecast periods");
  const matrix = page.getByRole("table", { name: "Budget forecast matrix" });
  await expect
    .poll(async () => (await emptyState.count()) + (await matrix.count()))
    .toBeGreaterThan(0);

  if ((await matrix.count()) > 0) {
    const firstCell = matrix.getByRole("button").first();
    await firstCell.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(firstCell).toBeFocused();
  } else {
    await expect(emptyState).toBeVisible();
    const includePaused = page.getByRole("checkbox", {
      name: "Include paused budgets or history",
    });
    await includePaused.press("Space");
    await expect(includePaused).toBeChecked();
    await expect(page.getByText("Forecast ready").first()).toBeVisible();
  }
});
