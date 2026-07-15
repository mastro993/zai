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
      destination: {
        type: "budget",
        budgetId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      },
    },
  ],
  nextCursor: null,
};

const readAlert = {
  ...fixedAlerts.items[0],
  readAt: "2026-07-14T11:00:00",
};

const isUnreadFirstPageRequest = (url: string): boolean => {
  const parsed = new URL(url);
  return parsed.searchParams.get("readState") === "unread" && !parsed.searchParams.has("cursor");
};

const isDefaultListRequest = (url: string): boolean => {
  const parsed = new URL(url);
  return !parsed.searchParams.has("readState") && !parsed.searchParams.has("cursor");
};

const parsedHasCursor = (url: string): boolean => new URL(url).searchParams.has("cursor");

const isAlertListRequest = (url: string): boolean => new URL(url).pathname.endsWith("/alerts");

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

  test("exposes labelled mark read action and updates row state", async ({ page }) => {
    let currentAlerts = fixedAlerts;
    let currentUnreadCount = 1;

    await page.unroute("**/api/alerts/unread-count");
    await page.unroute("**/api/alerts");
    await page.route("**/api/alerts/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUnreadCount),
      });
    });
    await page.route((url) => isAlertListRequest(url.href), async (route) => {
      const url = route.request().url();
      if (isUnreadFirstPageRequest(url)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            currentUnreadCount > 0
              ? currentAlerts
              : { items: [], nextCursor: null },
          ),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentAlerts),
      });
    });
    await page.route("**/api/alerts/*/read", async (route) => {
      currentAlerts = { ...fixedAlerts, items: [readAlert] };
      currentUnreadCount = 0;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(readAlert),
      });
    });

    await page.goto("/dashboard");
    const listRefresh = page.waitForResponse(
      (response) =>
        response.url().includes("/api/alerts") &&
        response.request().method() === "GET" &&
        !response.url().includes("unread-count"),
    );
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();
    await listRefresh;

    const dialog = page.getByRole("dialog", { name: "Alerts" });
    const unreadFilterResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        isUnreadFirstPageRequest(response.url()),
    );
    await dialog.getByRole("button", { name: "Unread" }).click();
    await unreadFilterResponse;

    const markRead = page.getByRole("button", { name: "Mark read: Budget warning" });
    await expect(markRead).toBeVisible();
    const markReadResponse = page.waitForResponse((response) => response.url().includes("/read"));
    await markRead.click();
    await markReadResponse;

    await expect(page.getByText("Budget warning")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Alerts, 0 unread" })).toBeVisible();
  });

  test("marks all unread alerts read and disables action after reconciliation", async ({
    page,
  }) => {
    let allRead = false;
    await page.unroute("**/api/alerts/unread-count");
    await page.unroute("**/api/alerts");
    await page.route("**/api/alerts/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(allRead ? 0 : 1),
      });
    });
    await page.route((url) => isAlertListRequest(url.href), async (route) => {
      const url = route.request().url();
      if (isUnreadFirstPageRequest(url)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            allRead ? { items: [], nextCursor: null } : fixedAlerts,
          ),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(allRead ? { ...fixedAlerts, items: [readAlert] } : fixedAlerts),
      });
    });
    await page.route("**/api/alerts/mark-all-read", async (route) => {
      allRead = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(1),
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();

    const dialog = page.getByRole("dialog", { name: "Alerts" });
    const unreadFilterResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        isUnreadFirstPageRequest(response.url()),
    );
    await dialog.getByRole("button", { name: "Unread" }).click();
    await unreadFilterResponse;

    const markAllRead = dialog.getByRole("button", { name: "Mark all read" });
    await expect(markAllRead).toBeEnabled();
    await markAllRead.click();

    await expect(dialog.getByText("Budget warning")).toBeHidden();
    await expect(markAllRead).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Alerts, 0 unread" })).toBeVisible();
  });

  test("removes a read alert from the read filter after marking it unread", async ({ page }) => {
    const readAlerts = { ...fixedAlerts, items: [readAlert] };
    let currentUnreadCount = 0;

    await page.unroute("**/api/alerts/unread-count");
    await page.unroute("**/api/alerts");
    await page.route("**/api/alerts/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUnreadCount),
      });
    });
    await page.route((url) => isAlertListRequest(url.href), async (route) => {
      const url = route.request().url();
      if (new URL(url).searchParams.get("readState") === "read" && !parsedHasCursor(url)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            currentUnreadCount > 0 ? { items: [], nextCursor: null } : readAlerts,
          ),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(readAlerts),
      });
    });
    await page.route("**/api/alerts/*/unread", async (route) => {
      currentUnreadCount = 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixedAlerts.items[0]),
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Alerts, 0 unread" }).click();

    const dialog = page.getByRole("dialog", { name: "Alerts" });
    const readFilterResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        new URL(response.url()).searchParams.get("readState") === "read" &&
        !parsedHasCursor(response.url()),
    );
    await dialog.getByRole("button", { name: "Read", exact: true }).click();
    await readFilterResponse;

    const markUnread = page.getByRole("button", { name: "Mark unread: Budget warning" });
    await expect(markUnread).toBeVisible();
    const markUnreadResponse = page.waitForResponse((response) =>
      response.url().includes("/unread"),
    );
    await markUnread.click();
    await markUnreadResponse;

    await expect(dialog.getByText("Budget warning")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Alerts, 1 unread" })).toBeVisible();
  });

  test("marks unread alert read before navigating to budget destination", async ({ page }) => {
    let markedRead = false;
    await page.route("**/api/alerts/*/read", async (route) => {
      markedRead = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(readAlert),
      });
    });
    await page.route("**/api/cash-flow/budgets/*/history*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          page: 1,
          perPage: 50,
          totalPages: 1,
        }),
      });
    });
    await page.route("**/api/cash-flow/transaction-categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/cash-flow/budgets/*", async (route) => {
      expect(markedRead).toBe(true);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
          name: "Monthly groceries",
          revision: 1,
          paused: false,
          categoryIds: [],
          cadence: "month",
          measurementMode: "spending",
          baseAllowance: 10000,
          rolloverMode: "off",
          warningPercentage: 80,
          currentPeriod: {
            start: "2026-07-01T00:00:00",
            end: "2026-08-01T00:00:00",
            baseAllowance: 10000,
            effectiveAllowance: 10000,
            netBudgetSpending: 2500,
            remainingAllowance: 7500,
            status: "onTrack",
          },
        }),
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();
    await page.getByRole("button", { name: "Open alert: Budget warning" }).click();

    await expect(page).toHaveURL(/\/cash-flow\/budgets\/6ba7b811-9dad-11d1-80b4-00c04fd430c8$/);
  });

  test("filters alerts and loads older pages from cursor", async ({ page }) => {
    await page.unroute("**/api/alerts");
    await page.route("**/api/alerts?*", async (route) => {
      const url = route.request().url();

      if (isUnreadFirstPageRequest(url)) {
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

      if (new URL(url).searchParams.get("cursor") === "cursor-page-2") {
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
    const dialog = page.getByRole("dialog", { name: "Alerts" });
    const ledgerOpen = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        isDefaultListRequest(response.url()),
    );
    await page.getByRole("button", { name: "Alerts, 1 unread" }).click();
    await ledgerOpen;
    await expect(dialog).toBeVisible();

    const unreadButton = dialog.getByRole("button", { name: "Unread" });
    if ((await unreadButton.getAttribute("aria-pressed")) === "true") {
      const readFilterResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.ok() &&
          new URL(response.url()).searchParams.get("readState") === "read",
      );
      await dialog.getByRole("button", { name: "Read" }).click();
      await readFilterResponse;
    }

    const unreadFilterResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        isUnreadFirstPageRequest(response.url()),
    );
    await unreadButton.click();
    await unreadFilterResponse;

    await expect(dialog.getByRole("button", { name: "Load older alerts" })).toBeVisible();

    const olderPageResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.ok() &&
        new URL(response.url()).searchParams.get("cursor") === "cursor-page-2",
    );
    await dialog.getByRole("button", { name: "Load older alerts" }).click();
    await olderPageResponse;

    await expect(dialog.getByText("Older warning")).toBeVisible();
  });
});
