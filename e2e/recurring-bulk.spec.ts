import { expect, test, type Page } from "@playwright/test";

import {
  createApiRecurring,
  createApiCategory,
  deleteApiCategory,
  getApiDocument,
  localDateTime,
  updateApiRecurringDescription,
} from "./recurring-production-helpers";

async function selectFilteredBatch(page: Page, prefix: string) {
  await page.getByPlaceholder("Search descriptions").fill(prefix);
  await expect(page.getByRole("checkbox", { name: "Select all on this page" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Select all on this page" }).click();
  const selectAllMatching = page.getByRole("button", { name: "Select all matching" });
  if (await selectAllMatching.count()) {
    await selectAllMatching.click();
  }
  await expect(page.getByRole("region", { name: "Bulk selection" })).toContainText("selected");
}

async function confirmBulkAction(page: Page, action: string, confirmation: string) {
  await page.getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`${action} selected`) });
  await expect(dialog).toContainText("selected");
  await dialog.getByRole("button", { name: confirmation, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("web freezes filtered selections and runs every recurring bulk lifecycle action", async ({
  page,
}, testInfo) => {
  const prefix = `E2E bulk ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  await Promise.all(
    Array.from({ length: 51 }, (_, index) =>
      createApiRecurring(page.request, {
        description: `${prefix} ${String(index + 1).padStart(2, "0")}`,
        firstScheduledLocal: localDateTime(5),
        totalOccurrences: 2,
      }),
    ),
  );

  await page.goto("/cash-flow/recurring");
  await selectFilteredBatch(page, prefix);
  await expect(page.getByRole("region", { name: "Bulk selection" })).toContainText("51 selected");
  await page.getByPlaceholder("Search descriptions").fill(`${prefix} 01`);
  await expect(page.getByRole("region", { name: "Bulk selection" })).toContainText("50 hidden");
  await expect(page.getByRole("region", { name: "Bulk selection" })).toContainText(
    "filters frozen",
  );

  await confirmBulkAction(page, "Pause", "Confirm");
  await expect(page.getByRole("region", { name: "Bulk selection" })).toHaveCount(0);

  await selectFilteredBatch(page, prefix);
  await confirmBulkAction(page, "Resume", "Confirm");
  await expect(page.getByRole("region", { name: "Bulk selection" })).toHaveCount(0);

  await selectFilteredBatch(page, prefix);
  await confirmBulkAction(page, "Stop", "Stop");
  await expect(page.getByRole("region", { name: "Bulk selection" })).toHaveCount(0);

  await selectFilteredBatch(page, prefix);
  await confirmBulkAction(page, "Delete", "Delete");
  await expect(page.getByText("No recurring transactions match these filters.")).toBeVisible();
});

test("web reports concurrent eligibility changes as partial bulk success", async ({
  page,
}, testInfo) => {
  const prefix = `E2E concurrent bulk ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const sources = await Promise.all(
    ["first", "second"].map((name) =>
      createApiRecurring(page.request, {
        description: `${prefix} ${name}`,
        firstScheduledLocal: localDateTime(3),
        totalOccurrences: 2,
      }),
    ),
  );

  await page.goto("/cash-flow/recurring");
  await selectFilteredBatch(page, prefix);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Pause selected recurring transactions?" }),
  ).toBeVisible();

  const first = sources[0];
  expect(first).toBeDefined();
  if (first) {
    await updateApiRecurringDescription(page.request, first, `${prefix} changed elsewhere`);
  }
  await page
    .getByRole("dialog", { name: "Pause selected recurring transactions?" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();

  const result = page.getByRole("dialog", { name: "Bulk action results" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("1 succeeded · 1 unchanged · 0 failed.");
  await expect(result.getByRole("region", { name: "Unchanged" })).toContainText(
    "Changed by another update",
  );
  await result.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("region", { name: "Bulk selection" })).toContainText("1 selected");
});

test("web preserves committed bulk work when post-commit refresh is interrupted", async ({
  page,
}, testInfo) => {
  const prefix = `E2E refresh recovery ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const source = await createApiRecurring(page.request, {
    description: prefix,
    firstScheduledLocal: localDateTime(3),
    totalOccurrences: 2,
  });

  await page.goto("/cash-flow/recurring");
  await selectFilteredBatch(page, prefix);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Pause selected recurring transactions?",
  });
  await expect(confirmation).toBeVisible();

  let blockFeedRefresh = false;
  await page.route("**/api/cash-flow/recurring-transactions**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname.endsWith("/bulk/execute")) {
      const response = await route.fetch();
      blockFeedRefresh = true;
      await route.fulfill({ response });
      return;
    }
    if (
      blockFeedRefresh &&
      request.method() === "GET" &&
      pathname === "/api/cash-flow/recurring-transactions"
    ) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.continue();
  });

  await confirmation.getByRole("button", { name: "Confirm", exact: true }).click();

  const result = page.getByRole("dialog", { name: "Bulk action results" });
  await expect(result).toContainText(
    "Mutations already committed. Feed refresh failed; retry refresh without repeating successful work.",
  );
  blockFeedRefresh = false;
  await page.reload();

  const updated = await getApiDocument(page.request, source.recurringTransaction.id);
  expect(updated.recurringTransaction.lifecycle).toBe("paused");
  expect(updated.recurringTransaction.revision).toBe(source.recurringTransaction.revision + 1);
});

test("web retry preflight excludes repair-required sources", async ({ page }, testInfo) => {
  const prefix = `E2E retry preflight ${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const invalidCategory = await createApiCategory(page.request, `${prefix} invalid category`);
  await deleteApiCategory(page.request, invalidCategory.id);
  const source = await createApiRecurring(page.request, {
    description: prefix,
    firstScheduledLocal: localDateTime(-1),
    totalOccurrences: 1,
    transactionCategoryId: invalidCategory.id,
  });
  await expect
    .poll(
      async () =>
        (await getApiDocument(page.request, source.recurringTransaction.id)).failures.unresolved,
      { timeout: 45_000 },
    )
    .not.toBeNull();

  await page.goto("/cash-flow/recurring");
  await selectFilteredBatch(page, prefix);
  await page.getByRole("button", { name: "Retry now", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Retry selected generation failures?" });
  await expect(dialog).toContainText("1 repair needed");
  await expect(dialog.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear selection" }).click();
});
