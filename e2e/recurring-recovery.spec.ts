import { expect, test } from "@playwright/test";

import {
  createApiCategory,
  createApiRecurring,
  deleteApiCategory,
  getApiAlerts,
  getApiDocument,
  localDateTime,
  openRecurringDocument,
  waitForDocument,
} from "./recurring-production-helpers";

test("web repairs invalid generation, retries in order, resolves history, and deduplicates alerts", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${testInfo.repeatEachIndex}`;
  const category = await createApiCategory(page.request, `E2E repair category ${suffix}`);
  const invalidCategory = await createApiCategory(page.request, `E2E deleted category ${suffix}`);
  await deleteApiCategory(page.request, invalidCategory.id);
  const description = `E2E recovery ${suffix}`;
  const document = await createApiRecurring(page.request, {
    description,
    firstScheduledLocal: localDateTime(-2),
    totalOccurrences: 2,
    transactionCategoryId: invalidCategory.id,
  });

  await waitForDocument(
    page,
    document.recurringTransaction.id,
    (current) => current.failures.unresolved?.repairFieldKey === "transactionCategoryId",
  );

  await page.goto("/cash-flow/recurring");
  await openRecurringDocument(page, description);
  const recoveryBanner = page.locator('section[aria-label="Generation needs attention"]');
  await expect(recoveryBanner).toBeVisible();
  await expect(recoveryBanner).toContainText("Template problem");
  await expect(recoveryBanner).toContainText("Waiting later due");
  await recoveryBanner.getByRole("button", { name: "Repair" }).click();

  const repairDrawer = page.getByRole("dialog", { name: "Repair generation failure" });
  await repairDrawer.getByRole("button", { name: "Repair category" }).click();
  const categoryDrawer = page.getByRole("dialog", { name: "Choose category" });
  await categoryDrawer.getByRole("option", { name: category.name }).click();
  await expect(repairDrawer).toBeVisible();
  const previewResponse = page.waitForResponse((response) =>
    response.url().includes("/repair/preview"),
  );
  await repairDrawer.getByRole("button", { name: "Preview repair" }).click();
  const response = await previewResponse;
  const responseBody = await response.text();
  expect(response.ok(), responseBody).toBeTruthy();
  await expect(repairDrawer.getByRole("status")).toContainText("Proposed category");
  await expect(repairDrawer.getByRole("status")).toContainText("unfulfilled segment");
  await repairDrawer.getByRole("button", { name: "Repair & retry" }).click();

  await waitForDocument(
    page,
    document.recurringTransaction.id,
    (current) =>
      current.failures.unresolved === null && current.links.occurrences.items.length === 2,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Failures" })).toBeVisible();
  const historyToggle = page.getByRole("button", { name: "Show resolved failure history" });
  await historyToggle.click();
  await expect(page.getByRole("region", { name: "Resolved failure history" })).toContainText(
    "Recovered",
  );

  const alerts = await getApiAlerts(page.request);
  const recovered = await getApiDocument(page.request, document.recurringTransaction.id);
  const occurrenceAlerts = alerts.filter(
    (alert) => alert.producerKey === "recurring.occurrence" && alert.title.includes(description),
  );
  expect(occurrenceAlerts).toHaveLength(2);
  expect(new Set(occurrenceAlerts.map((alert) => alert.occurrenceKey)).size).toBe(2);
  expect(new Set(occurrenceAlerts.map((alert) => alert.data?.payload?.transactionId))).toEqual(
    new Set(recovered.links.occurrences.items.map((item) => item.transactionId)),
  );

  const failureAlerts = alerts.filter(
    (alert) =>
      alert.producerKey === "recurring.generation_failure" &&
      alert.occurrenceKey.startsWith(`${document.recurringTransaction.id}|`),
  );
  expect(failureAlerts).toHaveLength(1);
  expect(failureAlerts[0]?.resolvedAt).not.toBeNull();

  expect(recovered.links.occurrences.items.map((item) => item.transactionId)).toHaveLength(2);
  expect(recovered.failures.history.items).toHaveLength(1);
});
