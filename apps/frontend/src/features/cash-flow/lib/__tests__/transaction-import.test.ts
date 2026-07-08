import { describe, expect, it } from "vitest";

import {
  buildTransactionImportPreview,
  getDefaultTransactionImportMapping,
  parseImportAmount,
  parseImportDate,
  parseTransactionCsv,
  type TransactionImportPreviewOptions,
} from "../transaction-import";
import type { Transaction, TransactionCategory } from "../../types/model";

const makeIdFactory = () => {
  let nextId = 1;

  return () => `id-${nextId++}`;
};

const buildPreview = (content: string, options: Partial<TransactionImportPreviewOptions> = {}) => {
  const headers = parseTransactionCsv(content)[options.headerRowIndex ?? 0] ?? [];

  return buildTransactionImportPreview(content, {
    headerRowIndex: 0,
    mapping: getDefaultTransactionImportMapping(headers),
    amountMode: "column-type",
    dateFormat: "YYYY-MM-DD",
    categoryLinkMode: "columns",
    categorySeparator: " - ",
    missingCategoryMode: "uncategorized",
    expenseTypeValues: "expense, debit",
    incomeTypeValues: "income, credit",
    existingCategories: [],
    existingTransactions: [],
    createId: makeIdFactory(),
    ...options,
  });
};

describe("transaction import", () => {
  it("imports positive amount rows with mapped type values", () => {
    const content = [
      "date,amount,type,description,notes,parent_category,category",
      "2026-01-15,12.50,debit,Groceries,,Food,Groceries",
    ].join("\n");

    const preview = buildPreview(content);

    expect(preview.summary.importableRows).toBe(1);
    expect(preview.transactions).toEqual([
      {
        id: "id-1",
        description: "Groceries",
        amount: 1250,
        transactionDate: "2026-01-15T00:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      },
    ]);
  });

  it("infers type from signed amounts", () => {
    const content = [
      "date,amount,description",
      "2026-01-15,-12.50,Groceries",
      "2026-01-16,8,income",
    ].join("\n");
    const headers = parseTransactionCsv(content)[0] ?? [];

    const preview = buildPreview(content, {
      mapping: getDefaultTransactionImportMapping(headers),
      amountMode: "signed",
    });

    expect(preview.transactions.map((transaction) => transaction.transactionType)).toEqual([
      "expense",
      "income",
    ]);
    expect(preview.transactions.map((transaction) => transaction.amount)).toEqual([1250, 800]);
  });

  it("parses ISO datetime values", () => {
    expect(parseImportDate("2026-01-15T08:30:00", "ISO")).toEqual({
      ok: true,
      value: "2026-01-15T08:30:00",
    });
    expect(parseImportDate("2026-01-15T08:30", "ISO")).toEqual({
      ok: true,
      value: "2026-01-15T08:30:00",
    });
  });

  it("parses selected date formats", () => {
    expect(parseImportDate("15/01/2026", "DD/MM/YYYY")).toEqual({
      ok: true,
      value: "2026-01-15T00:00:00",
    });
    expect(parseImportDate("01/15/2026", "MM/DD/YYYY")).toEqual({
      ok: true,
      value: "2026-01-15T00:00:00",
    });
  });

  it("strips currency symbols and comma decimals", () => {
    expect(parseImportAmount("€12,50")).toEqual({ ok: true, cents: 1250, signed: 12.5 });
  });

  it("maps Name column to description when Category is present", () => {
    const headers = ["Date", "Type", "Category", "Amount", "Name", "Notes"];
    const mapping = getDefaultTransactionImportMapping(headers);

    expect(mapping.categoryName).toBe(2);
    expect(mapping.description).toBe(4);
  });

  it("skips duplicate transactions by date, amount, and description", () => {
    const content = ["date,amount,type,description", "2026-01-15,12.50,expense,Groceries"].join(
      "\n",
    );
    const existingTransactions: Array<Transaction> = [
      {
        id: "existing",
        description: "Groceries",
        amount: 1250,
        transactionDate: "2026-01-15T08:30:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      },
    ];

    const preview = buildPreview(content, { existingTransactions });

    expect(preview.summary.duplicateRows).toBe(1);
    expect(preview.transactions).toHaveLength(0);
  });

  it("creates missing categories when configured", () => {
    const content = ["date,amount,type,category", "2026-01-15,12.50,expense,Food - Groceries"].join(
      "\n",
    );
    const headers = parseTransactionCsv(content)[0] ?? [];

    const preview = buildPreview(content, {
      mapping: {
        ...getDefaultTransactionImportMapping(headers),
        categoryName: findCategoryColumn(headers),
      },
      categoryLinkMode: "single-column",
      missingCategoryMode: "create",
    });

    expect(preview.summary.categoriesToCreate).toBe(2);
    expect(preview.transactions[0]?.transactionCategoryId).toBe("id-2");
  });

  it("keeps transaction category IDs aligned with preview categories", () => {
    const content = ["date,amount,type,category", "2026-01-15,12.50,expense,Food"].join("\n");
    const headers = parseTransactionCsv(content)[0] ?? [];

    const preview = buildPreview(content, {
      mapping: {
        ...getDefaultTransactionImportMapping(headers),
        categoryName: findCategoryColumn(headers),
      },
      categoryLinkMode: "single-column",
      missingCategoryMode: "create",
    });

    expect(preview.categories).toHaveLength(1);
    expect(preview.transactions[0]?.transactionCategoryId).toBe(preview.categories[0]?.id);
  });

  it("resolves existing category paths in columns mode", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#C92A2A",
      parent: null,
    };
    const child: TransactionCategory = {
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: null,
      parent: root,
    };
    const content = [
      "date,amount,type,parent_category,category",
      "2026-01-15,12.50,expense,Food,Groceries",
    ].join("\n");

    const preview = buildPreview(content, {
      existingCategories: [root, child],
    });

    expect(preview.transactions[0]?.transactionCategoryId).toBe("child");
  });

  it("falls back to nearest existing ancestor when child is missing", () => {
    const health: TransactionCategory = {
      id: "health-root",
      parentId: null,
      name: "Health",
      description: null,
      color: "#C92A2A",
      parent: null,
    };
    const content = ["date,amount,type,category", "2026-01-15,12.50,expense,Health - Other"].join(
      "\n",
    );
    const headers = parseTransactionCsv(content)[0] ?? [];

    const preview = buildPreview(content, {
      mapping: {
        ...getDefaultTransactionImportMapping(headers),
        categoryName: findCategoryColumn(headers),
      },
      categoryLinkMode: "single-column",
      existingCategories: [health],
    });

    expect(preview.transactions[0]?.transactionCategoryId).toBe("health-root");
    expect(preview.rows[0]?.message).toContain('Child category "Other" not found');
  });
});

const findCategoryColumn = (headers: Array<string>) =>
  headers.findIndex((header) => header.trim().toLowerCase() === "category");
