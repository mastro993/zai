import { describe, expect, it } from "vitest";

import {
  getDefaultTransactionImportMapping,
  mapTransactionImportRows,
  parseImportAmount,
  parseImportDate,
  parseTransactionCsv,
  type MapTransactionImportOptions,
  type TransactionImportDateFormat,
} from "../transaction-import";
import type { TransactionCategory } from "@/features/categories/types/model";

const mapRows = (content: string, options: Partial<MapTransactionImportOptions> = {}) => {
  const headers = parseTransactionCsv(content)[options.headerRowIndex ?? 0] ?? [];

  return mapTransactionImportRows(content, {
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
    confirmedTransactionCurrency: "EUR",
    rateDirection: "transactionToDefault",
    ...options,
  });
};

describe("transaction import mapping", () => {
  it("maps positive amount rows with currency and type values", () => {
    const content = [
      "date,amount,type,description,notes,parent_category,category,currency",
      "2026-01-15,12.50,debit,Groceries,,Food,Groceries,EUR",
    ].join("\n");

    const mapped = mapRows(content);

    expect(mapped.hasCurrencyColumn).toBe(true);
    expect(mapped.rows).toEqual([
      {
        rowNumber: 2,
        date: "2026-01-15T00:00:00",
        amountMinor: 1250,
        currency: "EUR",
        transactionType: "expense",
        description: "Groceries",
      },
    ]);
  });

  it("uses one confirmed currency for currencyless files", () => {
    const content = [
      "date,amount,type,description,notes,parent_category,category",
      "2026-01-15,12.50,expense,Groceries,,Food,Groceries",
    ].join("\n");

    const mapped = mapRows(content, { confirmedTransactionCurrency: "USD" });

    expect(mapped.hasCurrencyColumn).toBe(false);
    expect(mapped.rows[0]?.currency).toBe("USD");
  });

  it("infers type from signed amounts", () => {
    const content = [
      "date,amount,description",
      "2026-01-15,€-12.50,Groceries",
      "2026-01-16,8,income",
    ].join("\n");
    const headers = parseTransactionCsv(content)[0] ?? [];

    const mapped = mapRows(content, {
      mapping: getDefaultTransactionImportMapping(headers),
      amountMode: "signed",
    });

    expect(mapped.rows.map((row) => row.transactionType)).toEqual(["expense", "income"]);
    expect(mapped.rows.map((row) => row.amountMinor)).toEqual([1250, 800]);
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

  it("rejects impossible calendar dates without normalization", () => {
    const invalidDate = { ok: false, message: "Invalid date" };

    const impossibleDates: Array<[string, TransactionImportDateFormat]> = [
      ["2026-02-30", "YYYY-MM-DD"],
      ["2026-04-31", "YYYY-MM-DD"],
      ["2026-02-29", "YYYY-MM-DD"],
      ["30/02/2028", "DD/MM/YYYY"],
      ["31/04/2026", "DD/MM/YYYY"],
      ["02/29/2026", "MM/DD/YYYY"],
      ["04/31/2026", "MM/DD/YYYY"],
      ["2026-00-15", "YYYY-MM-DD"],
      ["2026-13-01", "YYYY-MM-DD"],
      ["2026-01-00", "YYYY-MM-DD"],
      ["00/01/2026", "DD/MM/YYYY"],
      ["15/00/2026", "DD/MM/YYYY"],
      ["2026-01-15T24:00:00", "ISO"],
      ["2026-01-15T08:60:00", "ISO"],
      ["2026-01-15T08:30:60", "ISO"],
    ];

    for (const [raw, format] of impossibleDates) {
      expect(parseImportDate(raw, format)).toEqual(invalidDate);
    }
  });

  it("accepts valid calendar boundary dates", () => {
    expect(parseImportDate("2028-02-29", "YYYY-MM-DD")).toEqual({
      ok: true,
      value: "2028-02-29T00:00:00",
    });
    expect(parseImportDate("2026-04-30", "YYYY-MM-DD")).toEqual({
      ok: true,
      value: "2026-04-30T00:00:00",
    });
    expect(parseImportDate("29/02/2028", "DD/MM/YYYY")).toEqual({
      ok: true,
      value: "2028-02-29T00:00:00",
    });
    expect(parseImportDate("02/29/2028", "MM/DD/YYYY")).toEqual({
      ok: true,
      value: "2028-02-29T00:00:00",
    });
    expect(parseImportDate("2026-01-15T23:59:59", "ISO")).toEqual({
      ok: true,
      value: "2026-01-15T23:59:59",
    });
  });

  it("produces equivalent canonical output across supported date orderings", () => {
    const canonical = "2026-01-15T00:00:00";

    expect(parseImportDate("2026-01-15", "YYYY-MM-DD")).toEqual({ ok: true, value: canonical });
    expect(parseImportDate("15/01/2026", "DD/MM/YYYY")).toEqual({ ok: true, value: canonical });
    expect(parseImportDate("01/15/2026", "MM/DD/YYYY")).toEqual({ ok: true, value: canonical });
    expect(parseImportDate("15-01-2026", "DD-MM-YYYY")).toEqual({ ok: true, value: canonical });
    expect(parseImportDate("15.01.2026", "DD.MM.YYYY")).toEqual({ ok: true, value: canonical });
  });

  it("omits invalid dates from mapped rows so the backend can block", () => {
    const content = [
      "date,amount,type,description",
      "2026-02-30,12.50,expense,Groceries",
      "2026-01-15,12.50,expense,Valid row",
    ].join("\n");

    const mapped = mapRows(content);

    expect(mapped.rows[0]?.date).toBeUndefined();
    expect(mapped.rows[1]?.date).toBe("2026-01-15T00:00:00");
  });

  it("parses dates without leading zeros", () => {
    expect(parseImportDate("2/12/2023", "DD/MM/YYYY")).toEqual({
      ok: true,
      value: "2023-12-02T00:00:00",
    });
    expect(parseImportDate("2023-1-5", "YYYY-MM-DD")).toEqual({
      ok: true,
      value: "2023-01-05T00:00:00",
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

  it("maps native Zai export amount_minor and rate fields", () => {
    const content = [
      "zai_export_version,date,amount_minor,amount,currency,type,description,notes,parent_category,category,rate_variant,rate_state,rate_date,source_observation_date,source_currency,reference_currency,coefficient,scale,original_decimal,formula_version,origin",
      "1,2026-01-15T08:30:00,350,3.50,EUR,expense,Coffee,,Food,Groceries,identity,complete,2026-01-15,,EUR,EUR,1,0,1,1,supplied",
    ].join("\n");

    const mapped = mapRows(content, { dateFormat: "ISO", missingCategoryMode: "create" });

    expect(mapped.isZaiExport).toBe(true);
    expect(mapped.hasCurrencyColumn).toBe(true);
    expect(mapped.rows[0]).toMatchObject({
      amountMinor: 350,
      currency: "EUR",
      transactionType: "expense",
      description: "Coffee",
      parentCategory: "Food",
      category: "Groceries",
      native: {
        exportVersion: 1,
        rateVariant: "identity",
        rateState: "complete",
        rateDate: "2026-01-15",
        sourceCurrency: "EUR",
        referenceCurrency: "EUR",
        coefficient: 1,
        scale: 0,
        originalDecimal: "1",
        formulaVersion: 1,
        origin: "supplied",
      },
    });
  });

  it("maps existing category names in create mode", () => {
    const content = ["date,amount,type,category", "2026-01-15,12.50,expense,Food - Groceries"].join(
      "\n",
    );
    const headers = parseTransactionCsv(content)[0] ?? [];

    const mapped = mapRows(content, {
      mapping: {
        ...getDefaultTransactionImportMapping(headers),
        categoryName: headers.findIndex((header) => header.trim().toLowerCase() === "category"),
      },
      categoryLinkMode: "single-column",
      missingCategoryMode: "create",
    });

    expect(mapped.rows[0]).toMatchObject({
      parentCategory: "Food",
      category: "Groceries",
    });
  });

  it("resolves existing category paths in columns mode", () => {
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
    const content = [
      "date,amount,type,parent_category,category",
      "2026-01-15,12.50,expense,Food,Groceries",
    ].join("\n");

    const mapped = mapRows(content, {
      existingCategories: [root, child],
    });

    expect(mapped.rows[0]).toMatchObject({
      parentCategory: "Food",
      category: "Groceries",
    });
  });
});
