import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const apiOrigin = process.env.VITE_ZAI_API_ORIGIN ?? "http://127.0.0.1:3000";

export interface RecurringDocument {
  recurringTransaction: {
    id: string;
    revision: number;
    lifecycle: string;
    fulfilledCount: number;
    totalOccurrences: number | null;
  };
  schedule: {
    firstScheduledLocal: string;
    rule: { type: string; every?: number; unit?: string; day?: number };
  };
  head?: { nextScheduledLocal: string } | null;
  template: {
    description: string;
    amount: number;
    currency: string;
    transactionType: string;
    transactionCategoryId: string | null;
    notes: string | null;
  };
  links: {
    occurrences: { items: Array<{ transactionId: string; fulfillmentKind: string }> };
  };
  failures: {
    unresolved: { repairFieldKey: string | null } | null;
    history: { items: Array<{ resolutionKind: string | null }> };
  };
  budgetImpact: {
    state: string;
    projection?: { complete: boolean; periods: Array<unknown>; sourceErrors: Array<unknown> };
  };
}

export interface DomainAlert {
  id: string;
  producerKey: string;
  occurrenceKey: string;
  title: string;
  resolvedAt: string | null;
  data?: { payload?: { recurringTransactionId?: string; transactionId?: string } };
}

export interface Category {
  id: string;
  name: string;
}

export interface Budget {
  id: string;
}

export async function apiJson<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await request.fetch(`${apiOrigin}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    data: body,
  });
  const responseBody = await response.text();
  expect(response.ok(), `${method} ${path}: ${responseBody}`).toBeTruthy();
  return JSON.parse(responseBody) as T;
}

export function localDateTime(offsetDays: number, offsetMinutes = 0): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export async function createApiCategory(
  request: APIRequestContext,
  name: string,
): Promise<Category> {
  return apiJson<Category>(request, "POST", "/api/categories", {
    name,
    parentId: null,
    description: null,
    color: null,
    role: "spending",
  });
}

export async function deleteApiCategory(request: APIRequestContext, categoryId: string) {
  return apiJson(request, "POST", "/api/categories/bulk-delete", {
    categoryIds: [categoryId],
    childrenStrategy: "block",
    confirmBudgetImpact: true,
  });
}

export async function createApiBudget(
  request: APIRequestContext,
  name: string,
  categoryId: string,
): Promise<Budget> {
  return apiJson<Budget>(request, "POST", "/api/budgets", {
    name,
    baseAllowance: 100000,
    cadence: "month",
    categoryIds: [categoryId],
    measurementMode: "spending",
    rolloverMode: "off",
    warningPercentage: 80,
  });
}

export async function createApiRecurring(
  request: APIRequestContext,
  input: {
    description: string;
    firstScheduledLocal: string;
    totalOccurrences?: number | null;
    transactionCategoryId?: string | null;
    amount?: number;
    schedule?: { type: "interval"; every: number; unit: "day" | "month" };
  },
): Promise<RecurringDocument> {
  const response = await apiJson<{ outcome: string; document: RecurringDocument }>(
    request,
    "POST",
    "/api/recurring-transactions",
    {
      schedule: input.schedule ?? { type: "interval", every: 1, unit: "day" },
      firstScheduledLocal: input.firstScheduledLocal,
      totalOccurrences: input.totalOccurrences ?? null,
      template: {
        description: input.description,
        amount: input.amount ?? 12000,
        currency: "EUR",
        transactionType: "expense",
        transactionCategoryId: input.transactionCategoryId ?? null,
        notes: null,
      },
    },
  );
  expect(response.outcome).toBe("succeeded");
  return response.document;
}

export async function createApiTransaction(
  request: APIRequestContext,
  input: { id: string; description: string; transactionDate: string },
) {
  return apiJson(request, "POST", "/api/transactions", {
    id: input.id,
    description: input.description,
    amount: 5000,
    currency: "EUR",
    transactionDate: input.transactionDate,
    transactionType: "expense",
    transactionCategoryId: null,
    notes: null,
  });
}

export async function getApiDocument(
  request: APIRequestContext,
  recurringTransactionId: string,
): Promise<RecurringDocument> {
  return apiJson<RecurringDocument>(
    request,
    "GET",
    `/api/recurring-transactions/${recurringTransactionId}`,
  );
}

export async function getApiAlerts(request: APIRequestContext): Promise<Array<DomainAlert>> {
  const page = await apiJson<{ items: Array<DomainAlert> }>(
    request,
    "GET",
    "/api/alerts?limit=100",
  );
  return page.items;
}

export async function waitForDocument(
  page: Page,
  recurringTransactionId: string,
  predicate: (document: RecurringDocument) => boolean,
) {
  await expect
    .poll(
      async () => {
        const document = await getApiDocument(page.request, recurringTransactionId);
        return predicate(document)
          ? "ready"
          : `${document.template.description}: ${document.links.occurrences.items.length} links, ${document.recurringTransaction.lifecycle}`;
      },
      { timeout: 45_000 },
    )
    .toBe("ready");
}

export async function fillRecurringFirstOccurrence(
  page: Page,
  drawer: Locator,
  firstScheduledLocal: string,
  fieldLabel: "First occurrence" | "Next occurrence" = "First occurrence",
) {
  const date = firstScheduledLocal.slice(0, 10);
  const time = firstScheduledLocal.slice(11, 16);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));

  await drawer.getByLabel(fieldLabel).click();
  const calendar = page.locator('[data-slot="calendar"]');
  const target = await page.evaluate(
    ({ targetYear, targetMonth, targetDay }) => {
      const selectedDate = new Date(targetYear, targetMonth - 1, targetDay);
      const currentDate = new Date();
      return {
        dataDay: selectedDate.toLocaleDateString(),
        monthOffset:
          selectedDate.getFullYear() * 12 +
          selectedDate.getMonth() -
          (currentDate.getFullYear() * 12 + currentDate.getMonth()),
      };
    },
    { targetYear: year, targetMonth: month, targetDay: day },
  );
  const navigationLabel =
    target.monthOffset < 0 ? "Go to the Previous Month" : "Go to the Next Month";

  for (let offset = 0; offset < Math.abs(target.monthOffset); offset += 1) {
    await calendar.getByRole("button", { name: navigationLabel }).click();
  }

  await calendar.locator(`[data-day="${target.dataDay}"]`).click();
  await page.keyboard.press("Escape");
  await drawer.getByLabel("Time").fill(time);
}

export async function selectRecurringFormOption(
  page: Page,
  drawer: Locator,
  triggerName: string,
  optionName: string,
) {
  await drawer.getByRole("combobox", { name: triggerName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

export async function createRecurringInUi(
  page: Page,
  input: { description: string; firstScheduledLocal: string; totalOccurrences?: number },
) {
  const createButton = page.getByRole("button", { name: "New recurring" });
  await createButton.click();
  const drawer = page.getByRole("dialog", { name: "New recurring transaction" });
  await drawer.getByLabel("Description").fill(input.description);
  await drawer.getByLabel("Amount").fill("120.00");
  await fillRecurringFirstOccurrence(page, drawer, input.firstScheduledLocal);
  if (input.totalOccurrences !== undefined) {
    await drawer.getByLabel("Occurrences").fill(String(input.totalOccurrences));
  }
  await drawer.getByRole("button", { name: "Create recurring transaction" }).click();
  await expect(page.getByRole("link", { name: input.description })).toBeVisible();
}

export async function openRecurringDocument(page: Page, description: string) {
  await page.getByRole("link", { name: description, exact: true }).click();
  await expect(page).toHaveURL(/\/cash-flow\/recurring\/[^/]+$/);
  await expect(page.getByRole("heading", { name: description })).toBeVisible();
}

export async function updateApiRecurringDescription(
  request: APIRequestContext,
  document: RecurringDocument,
  description: string,
) {
  return apiJson(
    request,
    "POST",
    `/api/recurring-transactions/${document.recurringTransaction.id}`,
    {
      recurringTransactionId: document.recurringTransaction.id,
      expectedRevision: document.recurringTransaction.revision,
      schedule: document.schedule.rule,
      nextScheduledLocal:
        document.head?.nextScheduledLocal ?? document.schedule.firstScheduledLocal,
      totalOccurrences: document.recurringTransaction.totalOccurrences,
      template: {
        description,
        amount: document.template.amount,
        currency: document.template.currency,
        transactionType: document.template.transactionType,
        transactionCategoryId: document.template.transactionCategoryId,
        notes: document.template.notes,
      },
    },
  );
}
