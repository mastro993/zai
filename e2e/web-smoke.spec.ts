import { expect, test } from "@playwright/test";

const sidebarPreferenceKey = "zai-sidebar-preference";

test("web shell keeps full-height sidebar with content-column title bar", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/dashboard");

  const sidebarContainer = page.locator('[data-slot="sidebar-container"]');
  const titleBar = page.getByRole("banner");
  const sidebarBox = await sidebarContainer.boundingBox();
  const titleBarBox = await titleBar.boundingBox();

  expect(sidebarBox).not.toBeNull();
  expect(titleBarBox).not.toBeNull();
  if (!sidebarBox || !titleBarBox) {
    return;
  }

  // Sidebar spans full viewport height; title bar starts after it.
  expect(sidebarBox.y).toBe(0);
  expect(sidebarBox.height).toBe(768);
  expect(titleBarBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);
  expect(titleBarBox.y).toBe(0);

  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("transition-duration", "0.2s");
  await expect(page.locator('[data-slot="title-bar-leading"]')).toHaveCSS(
    "transition-duration",
    "0.2s",
  );

  // Expanded: toggle sits after the brand inside the sidebar chrome.
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "48px");
});

test("web shell keeps wide sidebar preference separate from narrow navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, open: false }));
  }, sidebarPreferenceKey);
  await page.reload();

  await expect(page).toHaveTitle("Zai");
  await expect(page.getByRole("banner")).toHaveAttribute("data-build-target", "web");
  await expect(page.getByRole("button", { name: /Alerts/ })).toBeVisible();
  await expect(page.locator('[data-tauri-drag-region="true"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="sidebar-brand"]')).toBeVisible();
  await expect(page.locator('[data-slot="sidebar-brand"]')).toContainText("財");
  await expect(page.locator('[data-slot="sidebar-brand"]')).toContainText("Zai");
  await expect(page.locator('[data-slot="sidebar-brand"]')).toHaveAttribute(
    "data-wordmark",
    "true",
  );
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "256px");
  await expect(page.locator('[data-slot="title-bar-leading"]')).toHaveCSS(
    "transition-duration",
    "0s",
  );

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  // Collapsed icon rail: kanji by default; hover reveals toggle to re-expand.
  const collapsedChrome = page.locator('[data-slot="sidebar-collapsed-chrome"]');
  await expect(collapsedChrome).toBeVisible();
  await expect(page.locator('[data-slot="sidebar-brand"]')).toHaveAttribute(
    "data-wordmark",
    "false",
  );
  await expect(page.locator('[data-slot="sidebar-brand"]')).toContainText("財");
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "48px");
  await collapsedChrome.hover();
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "256px");
  await expect(page.locator('[data-slot="sidebar-brand"]')).toHaveAttribute(
    "data-wordmark",
    "true",
  );

  // Collapse again and persist.
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "48px");
  await expect(
    page.evaluate((key) => localStorage.getItem(key), sidebarPreferenceKey),
  ).resolves.toBe(JSON.stringify({ version: 1, open: false }));
  await expect(page.evaluate(() => document.cookie)).resolves.not.toContain("sidebar_state=");

  await page.reload();

  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "48px");
  await expect(page.locator('[data-slot="sidebar-collapsed-chrome"]')).toBeVisible();
  await expect(page.locator('[data-slot="sidebar-brand"]')).toHaveAttribute(
    "data-wordmark",
    "false",
  );

  await page.setViewportSize({ width: 767, height: 768 });
  await page.reload();

  const mobileSidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  await expect(mobileSidebar).toBeHidden();
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  await expect(mobileSidebar).toBeVisible();
  await expect(
    page.evaluate((key) => localStorage.getItem(key), sidebarPreferenceKey),
  ).resolves.toBe(JSON.stringify({ version: 1, open: false }));
});

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
