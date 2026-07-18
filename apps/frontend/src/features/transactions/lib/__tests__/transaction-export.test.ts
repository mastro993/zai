import { describe, expect, it } from "vitest";

import {
  buildTransactionImportPreview,
  getDefaultTransactionImportMapping,
  parseTransactionCsv,
  type TransactionImportPreviewOptions,
} from "../transaction-import";
import { getTransactionExportFilename, toTransactionExportCsv } from "../transaction-export";
import type { Transaction } from "../../types/model";
import type { TransactionCategory } from "@/features/categories/types/model";

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
    existingDuplicateKeys: [],
    createId: makeIdFactory(),
    ...options,
  });
};

describe("transaction export", () => {
  it("formats the default filename with a compact local timestamp", () => {
    const filename = getTransactionExportFilename(new Date(2026, 6, 6, 16, 28, 30));

    expect(filename).toBe("zai_transactions_20260706_162830.csv");
  });

  it("exports transactions with parent/child categories and quoted fields", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#C92A2A",
      role: "spending",
      parent: null,
    };
    const child: TransactionCategory = {
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: null,
      role: "spending",
      parent: root,
    };
    const transactions: Array<Transaction> = [
      {
        id: "tx-1",
        description: 'Coffee, "special"',
        amount: 350,
        transactionDate: "2026-01-15T08:30:00",
        transactionType: "expense",
        transactionCategoryId: "child",
        notes: "Morning\nrun",
      },
      {
        id: "tx-2",
        description: "Salary",
        amount: 250000,
        transactionDate: "2026-01-01T00:00:00",
        transactionType: "income",
        transactionCategoryId: null,
        notes: null,
      },
    ];

    const csv = toTransactionExportCsv(transactions, [root, child]);

    expect(csv).toBe(
      [
        "date,amount,type,description,notes,parent_category,category",
        '2026-01-15T08:30:00,3.50,expense,"Coffee, ""special""","Morning\nrun",Food,Groceries',
        "2026-01-01T00:00:00,2500.00,income,Salary,,,",
      ].join("\n"),
    );
  });

  it("neutralizes spreadsheet formula prefixes", () => {
    const transaction: Transaction = {
      id: "tx-formula",
      description: "=1+1",
      amount: 100,
      transactionDate: "2026-01-15T08:30:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: "@SUM(A1)",
    };

    const csv = toTransactionExportCsv([transaction], []);

    expect(csv).toBe(
      [
        "date,amount,type,description,notes,parent_category,category",
        '2026-01-15T08:30:00,1.00,expense,"\t=1+1","\t@SUM(A1)",,',
      ].join("\n"),
    );

    const preview = buildPreview(csv, { dateFormat: "ISO" });
    expect(preview.transactions[0]).toMatchObject({
      description: "=1+1",
      notes: "@SUM(A1)",
    });
  });

  it("round-trips exported CSV through the import preview", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#C92A2A",
      role: "spending",
      parent: null,
    };
    const child: TransactionCategory = {
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: null,
      role: "spending",
      parent: root,
    };
    const transactions: Array<Transaction> = [
      {
        id: "tx-1",
        description: "Weekly shop",
        amount: 1250,
        transactionDate: "2026-01-15T12:00:00",
        transactionType: "expense",
        transactionCategoryId: "child",
        notes: "Card payment",
      },
    ];

    const preview = buildPreview(toTransactionExportCsv(transactions, [root, child]), {
      dateFormat: "ISO",
      existingCategories: [root, child],
    });

    expect(preview.summary.importableRows).toBe(1);
    expect(preview.transactions).toEqual([
      {
        id: "id-1",
        description: "Weekly shop",
        amount: 1250,
        transactionDate: "2026-01-15T12:00:00",
        transactionType: "expense",
        transactionCategoryId: "child",
        notes: "Card payment",
      },
    ]);
  });
});
