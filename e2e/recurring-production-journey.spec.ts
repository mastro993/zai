import { expect, test } from "@playwright/test";

import {
  createApiBudget,
  createApiCategory,
  createApiRecurring,
  createApiTransaction,
  createRecurringInUi,
  getApiDocument,
  localDateTime,
  openRecurringDocument,
  waitForDocument,
} from "./recurring-production-helpers";

const recurringLink = (page: import("@playwright/test").Page) =>
  page.getByRole("link", { name: /Open (generated|adopted) transaction for occurrence/ });

async function waitForLinkedOccurrences(page: import("@playwright/test").Page, count: number) {
  await expect.poll(async () => await recurringLink(page).count(), { timeout: 45_000 }).toBe(count);
}

test("web covers past, present, and future creation plus adoption catch-up", async ({
  page,
}, testInfo) => {
  const prefix = `E2E journey ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  await page.goto("/cash-flow/recurring");

  const sources = [
    { description: `${prefix} past`, firstScheduledLocal: localDateTime(-2), totalOccurrences: 1 },
    {
      description: `${prefix} present`,
      firstScheduledLocal: localDateTime(0, -60),
      totalOccurrences: 1,
    },
    {
      description: `${prefix} future`,
      firstScheduledLocal: localDateTime(3),
      totalOccurrences: 1,
    },
  ];

  for (const source of sources) {
    await createRecurringInUi(page, source);
  }

  for (const source of sources.slice(0, 2)) {
    await page.goto("/cash-flow/recurring");
    await openRecurringDocument(page, source.description);
    const recurringTransactionId = page.url().split("/").at(-1) ?? "";
    await waitForDocument(
      page,
      recurringTransactionId,
      (document) => document.links.occurrences.items.length === 1,
    );
    await page.reload();
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
    await expect(recurringLink(page)).toHaveCount(1);
  }

  await page.goto("/cash-flow/recurring");
  await openRecurringDocument(page, sources[2].description);
  const futureId = page.url().split("/").at(-1) ?? "";
  await waitForDocument(
    page,
    futureId,
    (document) => document.links.occurrences.items.length === 0,
  );
  await expect(page.getByText("No fulfilled transactions linked yet.")).toBeVisible();

  const transactionId = `e2e-adoption-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const adoptedDescription = `${prefix} adopted`;
  await createApiTransaction(page.request, {
    id: transactionId,
    description: adoptedDescription,
    transactionDate: localDateTime(-3),
  });

  await page.goto("/cash-flow/transactions");
  await page.getByRole("button", { name: `Adopt ${adoptedDescription} as recurring` }).click();
  const adoptionDrawer = page.getByRole("dialog", { name: "Adopt as recurring" });
  await adoptionDrawer.getByRole("button", { name: "day", exact: true }).click();
  await adoptionDrawer.getByRole("button", { name: "Finite", exact: true }).click();
  await adoptionDrawer.getByLabel("Number of occurrences").fill("3");
  await expect(adoptionDrawer.getByRole("status")).toContainText("catch up");
  await adoptionDrawer.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(page.getByText("Recurring transaction adopted")).toBeVisible();

  await page.goto("/cash-flow/recurring");
  await openRecurringDocument(page, adoptedDescription);
  const adoptedId = page.url().split("/").at(-1) ?? "";
  await waitForDocument(
    page,
    adoptedId,
    (document) => document.links.occurrences.items.length === 3,
  );
  await page.reload();
  await waitForLinkedOccurrences(page, 3);
  await expect(page.getByText("Adopted", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Generated", { exact: true })).toHaveCount(2);
});

test("web edits the full recurring configuration and preserves the revision", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const initialDescription = `E2E editable source ${suffix}`;
  const updatedDescription = `E2E edited source ${suffix}`;
  const category = await createApiCategory(page.request, `E2E edited category ${suffix}`);
  const nextScheduledLocal = localDateTime(7);
  const monthlyDay = Number(nextScheduledLocal.slice(8, 10));

  await page.goto("/cash-flow/recurring");
  await createRecurringInUi(page, {
    description: initialDescription,
    firstScheduledLocal: localDateTime(5),
    totalOccurrences: 2,
  });
  await openRecurringDocument(page, initialDescription);
  const recurringTransactionId = page.url().split("/").at(-1) ?? "";
  const initialDocument = await getApiDocument(page.request, recurringTransactionId);

  await page.getByRole("button", { name: "Edit recurring transaction" }).click();
  const editDrawer = page.getByRole("dialog", { name: "Edit recurring transaction" });
  await editDrawer.getByLabel("Description").fill(updatedDescription);
  await editDrawer.getByLabel("Amount").fill("145.50");
  await editDrawer.getByRole("button", { name: "Income", exact: true }).click();
  await editDrawer.getByLabel("Transaction category").click();
  await page
    .getByRole("dialog", { name: "Choose category" })
    .getByRole("option", { name: category.name })
    .click();
  await editDrawer.getByLabel("Notes").fill("Updated from production workflow");
  await editDrawer.getByRole("button", { name: "Monthly day", exact: true }).click();
  await editDrawer.getByLabel("Day of month").fill(String(monthlyDay));
  await editDrawer.getByLabel("Next occurrence").fill(nextScheduledLocal.slice(0, 16));
  await editDrawer.getByRole("button", { name: "Finite", exact: true }).click();
  await editDrawer.getByLabel("Number of occurrences").fill("3");
  await editDrawer.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Recurring transaction updated")).toBeVisible();

  await expect(page.getByRole("heading", { name: updatedDescription })).toBeVisible();
  await expect(page.getByText(`Monthly on day ${monthlyDay}`, { exact: true })).toBeVisible();
  await expect(page.getByText("income", { exact: true })).toBeVisible();
  await expect(page.getByText("€145.50", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const document = await getApiDocument(page.request, recurringTransactionId);
      return {
        description: document.template.description,
        amount: document.template.amount,
        transactionType: document.template.transactionType,
        categoryId: document.template.transactionCategoryId,
        scheduleType: document.schedule.rule.type,
        monthlyDay: document.schedule.rule.day,
        totalOccurrences: document.recurringTransaction.totalOccurrences,
        notes: document.template.notes,
        revision: document.recurringTransaction.revision,
      };
    })
    .toEqual({
      description: updatedDescription,
      amount: 14550,
      transactionType: "income",
      categoryId: category.id,
      scheduleType: "monthlyDay",
      monthlyDay,
      totalOccurrences: 3,
      notes: "Updated from production workflow",
      revision: initialDocument.recurringTransaction.revision + 1,
    });
});

test("web keeps recurring budget impact and forecast drill-down attributable", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const category = await createApiCategory(page.request, `E2E forecast category ${suffix}`);
  await createApiBudget(page.request, `E2E forecast budget ${suffix}`, category.id);
  const description = `E2E forecast source ${suffix}`;
  const document = await createApiRecurring(page.request, {
    description,
    firstScheduledLocal: localDateTime(1),
    totalOccurrences: 3,
    transactionCategoryId: category.id,
    amount: 12000,
  });

  await waitForDocument(page, document.recurringTransaction.id, (current) =>
    Boolean(current.budgetImpact.projection && current.budgetImpact.projection.periods.length > 0),
  );
  await page.goto("/cash-flow/recurring");
  await openRecurringDocument(page, description);
  await expect(
    page.getByRole("table", { name: "Recurring budget impact by period" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Projected occurrence attribution" }),
  ).toBeVisible();
  const attributionLinks = page.getByRole("link", {
    name: `Open recurring source for ${description}`,
  });
  await expect.poll(async () => attributionLinks.count()).toBeGreaterThanOrEqual(3);
  const attributionText = await attributionLinks.allTextContents();
  for (const ordinal of [1, 2, 3]) {
    expect(
      attributionText.filter((text) => text.includes(`occurrence ${ordinal}`)),
    ).not.toHaveLength(0);
  }

  await page.goto("/cash-flow/forecast");
  await expect(page.getByRole("table", { name: "Budget forecast matrix" })).toBeVisible();
  const cell = page
    .getByRole("table", { name: "Budget forecast matrix" })
    .getByRole("button")
    .first();
  await cell.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Source attribution")).toBeVisible();
  await expect(detail.getByRole("link", { name: description })).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(cell).toBeFocused();
});

test("recurring creation and dialogs return focus predictably", async ({ page }) => {
  await page.goto("/cash-flow/recurring");
  const createButton = page.getByRole("button", { name: "New recurring" });
  await createButton.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "New recurring transaction" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(createButton).toBeFocused();
});

test("web reconnects after a network interruption and keeps durable state available", async ({
  page,
}) => {
  await page.goto("/cash-flow/recurring");
  const heading = page.getByRole("heading", { name: "Recurring transactions" });
  await expect(heading).toBeVisible();

  await page.context().setOffline(true);
  await expect(heading).toBeVisible();
  await page.context().setOffline(false);
  await page.reload();
  await expect(heading).toBeVisible();
});
