import { expect, test } from "@playwright/test";

const fixedAlerts = {
  items: [
    {
      id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      producerKey: "budget.status",
      occurrenceKey: "period-1",
      severity: "warning",
      title: "Budget warning",
      body: "Spending exceeded 80% of allowance.",
      createdAt: "2026-07-14T10:00:00",
      readAt: null,
    },
  ],
  nextCursor: null,
};

test.describe("alerts ledger", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/alerts/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(1),
      });
    });
    await page.route("**/api/alerts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixedAlerts),
      });
    });
  });

  test("opens keyboard-operable ledger with focus return and responsive width", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const bell = page.getByRole("button", { name: "Alerts, 1 unread" });
    await expect(bell).toBeVisible();
    await bell.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Alerts" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Budget warning")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bell).toBeFocused();
  });

  test("uses full viewport width on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();

    const dialog = page.getByRole("dialog", { name: "Alerts" });
    const box = await dialog.boundingBox();
    expect(box?.width).toBeGreaterThan(350);
  });

  test("keeps unread dot static when reduced motion is preferred", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");

    const dot = page.locator("button[aria-label='Alerts, 1 unread'] span.bg-primary");
    await expect(dot).toBeVisible();
    await expect(dot).not.toHaveClass(/animate-pulse/);
  });

  test("filters alerts and loads older pages from cursor", async ({ page }) => {
    let listRequestCount = 0;
    await page.route("**/api/alerts", async (route) => {
      listRequestCount += 1;
      const url = new URL(route.request().url());
      const readState = url.searchParams.get("readState");
      const cursor = url.searchParams.get("cursor");

      if (readState === "unread" && !cursor) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [fixedAlerts.items[0]],
            nextCursor: "cursor-page-2",
          }),
        });
        return;
      }

      if (readState === "unread" && cursor === "cursor-page-2") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                ...fixedAlerts.items[0],
                id: "7ba7b810-9dad-11d1-80b4-00c04fd430c9",
                occurrenceKey: "period-2",
                title: "Older warning",
                createdAt: "2026-07-13T10:00:00",
              },
            ],
            nextCursor: null,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixedAlerts),
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();
    await page.getByRole("button", { name: "Unread" }).click();
    await expect(page.getByText("Budget warning")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load older alerts" })).toBeVisible();

    await page.getByRole("button", { name: "Load older alerts" }).click();
    await expect(page.getByText("Older warning")).toBeVisible();
    expect(listRequestCount).toBeGreaterThanOrEqual(3);
  });
});
