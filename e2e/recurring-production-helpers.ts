import { expect, type APIRequestContext, type Page } from "@playwright/test";

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
  return apiJson<Category>(request, "POST", "/api/cash-flow/categories", {
    name,
    parentId: null,
    description: null,
    color: null,
    role: "spending",
  });
}

export async function deleteApiCategory(request: APIRequestContext, categoryId: string) {
  return apiJson(request, "POST", "/api/cash-flow/categories/bulk-delete", {
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
  return apiJson<Budget>(request, "POST", "/api/cash-flow/budgets", {
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
    "/api/cash-flow/recurring-transactions",
    {
      schedule: input.schedule ?? { type: "interval", every: 1, unit: "day" },
      firstScheduledLocal: input.firstScheduledLocal,
      totalOccurrences: input.totalOccurrences ?? null,
      template: {
        description: input.description,
        amount: input.amount ?? 12000,
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
  return apiJson(request, "POST", "/api/cash-flow/transactions", {
    id: input.id,
    description: input.description,
    amount: 5000,
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
    `/api/cash-flow/recurring-transactions/${recurringTransactionId}`,
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

export async function createRecurringInUi(
  page: Page,
  input: { description: string; firstScheduledLocal: string; totalOccurrences?: number },
) {
  const createButton = page.getByRole("button", { name: "New recurring" });
  await createButton.click();
  const drawer = page.getByRole("dialog", { name: "New recurring transaction" });
  await drawer.getByLabel("Description").fill(input.description);
  await drawer.getByLabel("Amount").fill("120.00");
  await drawer.getByLabel("First occurrence").fill(input.firstScheduledLocal.slice(0, 16));
  if (input.totalOccurrences !== undefined) {
    await drawer.getByRole("button", { name: "Finite", exact: true }).click();
    await drawer.getByLabel("Number of occurrences").fill(String(input.totalOccurrences));
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
    `/api/cash-flow/recurring-transactions/${document.recurringTransaction.id}`,
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
        transactionType: document.template.transactionType,
        transactionCategoryId: document.template.transactionCategoryId,
        notes: document.template.notes,
      },
    },
  );
}
