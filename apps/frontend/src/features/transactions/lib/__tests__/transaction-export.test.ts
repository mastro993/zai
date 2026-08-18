import { describe, expect, it } from "vitest";

import {
  getDefaultTransactionImportMapping,
  mapTransactionImportRows,
  parseTransactionCsv,
} from "../transaction-import";
import { getTransactionExportFilename, toTransactionExportCsv } from "../transaction-export";
import { sampleTransaction } from "../../types/sample";
import type { Transaction } from "../../types/model";
import type { TransactionCategory } from "@/features/categories/types/model";

describe("transaction export", () => {
  it("formats the default filename with a compact local timestamp", () => {
    const filename = getTransactionExportFilename(new Date(2026, 6, 6, 16, 28, 30));

    expect(filename).toBe("zai_transactions_20260706_162830.csv");
  });

  it("exports full-fidelity source fields and quoted text", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#C55B26",
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
      sampleTransaction({
        id: "tx-1",
        description: 'Coffee, "special"',
        amount: 350,
        transactionDate: "2026-01-15T08:30:00",
        transactionType: "expense",
        transactionCategoryId: "child",
        notes: "Morning\nrun",
      }),
      sampleTransaction({
        id: "tx-2",
        description: "Salary",
        amount: 250000,
        transactionDate: "2026-01-01T00:00:00",
        transactionType: "income",
        transactionCategoryId: null,
        notes: null,
      }),
    ];

    const csv = toTransactionExportCsv(transactions, [root, child]);

    expect(csv).toBe(
      [
        "zai_export_version,date,amount_minor,amount,currency,type,description,notes,parent_category,category,rate_variant,rate_state,rate_date,source_observation_date,source_currency,reference_currency,coefficient,scale,original_decimal,formula_version,origin",
        '1,2026-01-15T08:30:00,350,3.50,EUR,expense,"Coffee, ""special""","Morning\nrun",Food,Groceries,identity,complete,2026-01-15,,EUR,EUR,1,0,1,1,supplied',
        "1,2026-01-01T00:00:00,250000,2500.00,EUR,income,Salary,,,,identity,complete,2026-01-01,,EUR,EUR,1,0,1,1,supplied",
      ].join("\n"),
    );
  });

  it("neutralizes spreadsheet formula prefixes", () => {
    const transaction: Transaction = sampleTransaction({
      id: "tx-formula",
      description: "=1+1",
      amount: 100,
      transactionDate: "2026-01-15T08:30:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: "@SUM(A1)",
    });

    const csv = toTransactionExportCsv([transaction], []);

    expect(csv).toContain('"\t=1+1"');
    expect(csv).toContain('"\t@SUM(A1)"');

    const headers = parseTransactionCsv(csv)[0] ?? [];
    const mapped = mapTransactionImportRows(csv, {
      headerRowIndex: 0,
      mapping: getDefaultTransactionImportMapping(headers),
      amountMode: "column-type",
      dateFormat: "ISO",
      categoryLinkMode: "columns",
      categorySeparator: " - ",
      missingCategoryMode: "create",
      expenseTypeValues: "expense, debit",
      incomeTypeValues: "income, credit",
      existingCategories: [],
      rateDirection: "transactionToDefault",
    });
    expect(mapped.rows[0]).toMatchObject({
      description: "=1+1",
      notes: "@SUM(A1)",
      amountMinor: 100,
      currency: "EUR",
    });
  });

  it("round-trips exported CSV through the import mapper", () => {
    const root: TransactionCategory = {
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#C55B26",
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
      sampleTransaction({
        id: "tx-1",
        description: "Weekly shop",
        amount: 1250,
        transactionDate: "2026-01-15T12:00:00",
        transactionType: "expense",
        transactionCategoryId: "child",
        notes: "Card payment",
      }),
    ];

    const csv = toTransactionExportCsv(transactions, [root, child]);
    const headers = parseTransactionCsv(csv)[0] ?? [];
    const mapped = mapTransactionImportRows(csv, {
      headerRowIndex: 0,
      mapping: getDefaultTransactionImportMapping(headers),
      amountMode: "column-type",
      dateFormat: "ISO",
      categoryLinkMode: "columns",
      categorySeparator: " - ",
      missingCategoryMode: "create",
      expenseTypeValues: "expense, debit",
      incomeTypeValues: "income, credit",
      existingCategories: [root, child],
      rateDirection: "transactionToDefault",
    });

    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]).toMatchObject({
      description: "Weekly shop",
      amountMinor: 1250,
      currency: "EUR",
      date: "2026-01-15T12:00:00",
      transactionType: "expense",
      notes: "Card payment",
      parentCategory: "Food",
      category: "Groceries",
    });
  });
});
