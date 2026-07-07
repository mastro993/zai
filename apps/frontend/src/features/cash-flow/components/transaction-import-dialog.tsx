import { R } from "@praha/byethrow";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { openTransactionImportFile, type TransactionImportFile } from "../commands/transaction-import";
import { importTransactionCategories } from "../commands/transaction-categories";
import { importTransactions } from "../commands/transactions";
import {
  buildTransactionImportPreview,
  getDefaultTransactionImportMapping,
  getDefaultTypeValueInputs,
  parseTransactionCsv,
  type TransactionImportAmountMode,
  type TransactionImportCategoryLinkMode,
  type TransactionImportColumnMapping,
  type TransactionImportDateFormat,
  type TransactionImportMissingCategoryMode,
  type TransactionImportPreviewStatus,
} from "../lib/transaction-import";
import type { Transaction, TransactionCategory } from "../types/model";

type TransactionImportDialogProps = {
  open: boolean;
  categories: Array<TransactionCategory>;
  transactions: Array<Transaction>;
  onOpenChange: (open: boolean) => void;
  onImported: (createdCount: number, skippedRows: number) => Promise<void>;
};

const EMPTY_COLUMN = "none";
const DEFAULT_SEPARATOR = " - ";

const DATE_FORMAT_OPTIONS: Array<{ value: TransactionImportDateFormat; label: string }> = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY" },
];

const statusLabels: Record<TransactionImportPreviewStatus, string> = {
  import: "Import",
  duplicate: "Skipped duplicate",
  invalid: "Skipped invalid",
  empty: "Skipped empty",
};

const getHeadersForRow = (content: string, headerRowIndex: number) =>
  parseTransactionCsv(content)[headerRowIndex] ?? [];

const toSelectValue = (column: number | null) => (column === null ? EMPTY_COLUMN : String(column));

const fromSelectValue = (value: unknown) => {
  const stringValue = String(value ?? EMPTY_COLUMN);

  return stringValue === EMPTY_COLUMN ? null : Number(stringValue);
};

function ColumnSelect({
  label,
  value,
  headers,
  allowNone = true,
  onChange,
}: {
  label: string;
  value: number | null;
  headers: Array<string>;
  allowNone?: boolean;
  onChange: (value: number | null) => void;
}) {
  const items = [
    ...(allowNone ? [{ value: EMPTY_COLUMN, label: "None" }] : []),
    ...headers.map((header, index) => ({
      value: String(index),
      label: header.trim() || `Column ${index + 1}`,
    })),
  ];

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={items}
        value={toSelectValue(value)}
        onValueChange={(next) => onChange(fromSelectValue(next))}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function TransactionImportPreviewTable({
  rows,
}: {
  rows: ReturnType<typeof buildTransactionImportPreview>["rows"];
}) {
  if (rows.length === 0) {
    return (
      <p className="border border-dashed p-4 text-xs text-muted-foreground">
        No importable rows. Skipped rows are reflected in the summary above.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto border">
      <table className="w-full min-w-[920px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            <th className="border-b px-3 py-2 font-medium">Row</th>
            <th className="border-b px-3 py-2 font-medium">Date</th>
            <th className="border-b px-3 py-2 font-medium">Amount</th>
            <th className="border-b px-3 py-2 font-medium">Type</th>
            <th className="border-b px-3 py-2 font-medium">Description</th>
            <th className="border-b px-3 py-2 font-medium">Notes</th>
            <th className="border-b px-3 py-2 font-medium">Category</th>
            <th className="border-b px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber} className="border-b last:border-b-0">
              <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
              <td className="px-3 py-2">{row.transactionDate || "-"}</td>
              <td className="px-3 py-2">{row.amount || "-"}</td>
              <td className="px-3 py-2">{row.transactionType || "-"}</td>
              <td className="px-3 py-2">{row.description || "-"}</td>
              <td className="px-3 py-2">{row.notes || "-"}</td>
              <td className="px-3 py-2">{row.category || "-"}</td>
              <td className="px-3 py-2">
                <span>{statusLabels[row.status]}</span>
                {row.message ? (
                  <span className="block text-muted-foreground">{row.message}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionImportDialog({
  open,
  categories,
  transactions,
  onOpenChange,
  onImported,
}: TransactionImportDialogProps) {
  const defaultTypeValues = getDefaultTypeValueInputs();
  const [file, setFile] = useState<TransactionImportFile | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<TransactionImportColumnMapping>({
    amount: null,
    transactionDate: null,
    transactionType: null,
    description: null,
    notes: null,
    categoryName: null,
    categoryParent: null,
  });
  const [amountMode, setAmountMode] = useState<TransactionImportAmountMode>("column-type");
  const [dateFormat, setDateFormat] = useState<TransactionImportDateFormat>("YYYY-MM-DD");
  const [categoryLinkMode, setCategoryLinkMode] =
    useState<TransactionImportCategoryLinkMode>("columns");
  const [categorySeparator, setCategorySeparator] = useState(DEFAULT_SEPARATOR);
  const [missingCategoryMode, setMissingCategoryMode] =
    useState<TransactionImportMissingCategoryMode>("uncategorized");
  const [expenseTypeValues, setExpenseTypeValues] = useState(defaultTypeValues.expenseTypeValues);
  const [incomeTypeValues, setIncomeTypeValues] = useState(defaultTypeValues.incomeTypeValues);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const preview = useMemo(() => {
    if (!file) {
      return null;
    }

    return buildTransactionImportPreview(file.content, {
      headerRowIndex,
      mapping,
      amountMode,
      dateFormat,
      categoryLinkMode,
      categorySeparator,
      missingCategoryMode,
      expenseTypeValues,
      incomeTypeValues,
      existingCategories: categories,
      existingTransactions: transactions,
    });
  }, [
    amountMode,
    categories,
    categoryLinkMode,
    categorySeparator,
    dateFormat,
    expenseTypeValues,
    file,
    headerRowIndex,
    incomeTypeValues,
    mapping,
    missingCategoryMode,
    transactions,
  ]);

  const updateMapping = (key: keyof TransactionImportColumnMapping, value: number | null) => {
    setMapping((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const selectFile = async () => {
    setIsPickingFile(true);
    const result = await openTransactionImportFile();
    setIsPickingFile(false);

    if (R.isFailure(result)) {
      toast.error("Failed to read CSV file", { description: result.error.message });
      return;
    }

    if (!result.value) {
      return;
    }

    const headers = getHeadersForRow(result.value.content, 0);
    setFile(result.value);
    setHeaderRowIndex(0);
    setMapping(getDefaultTransactionImportMapping(headers));
  };

  const changeHeaderRow = (value: string) => {
    if (!file) {
      return;
    }

    const rowCount = parseTransactionCsv(file.content).length;
    const parsedValue = Number.parseInt(value, 10);
    const nextHeaderRowIndex = Number.isNaN(parsedValue)
      ? 0
      : Math.max(0, Math.min(parsedValue, Math.max(rowCount - 1, 0)));

    setHeaderRowIndex(nextHeaderRowIndex);
    setMapping(getDefaultTransactionImportMapping(getHeadersForRow(file.content, nextHeaderRowIndex)));
  };

  const confirmImport = async () => {
    if (!preview || preview.transactions.length === 0) {
      return;
    }

    setIsImporting(true);

    if (preview.categories.length > 0) {
      const categoriesResult = await importTransactionCategories(preview.categories);

      if (R.isFailure(categoriesResult)) {
        setIsImporting(false);
        toast.error("Failed to create categories", { description: categoriesResult.error.message });
        return;
      }
    }

    const transactionsResult = await importTransactions(preview.transactions);
    setIsImporting(false);

    if (R.isFailure(transactionsResult)) {
      toast.error("Failed to import transactions", { description: transactionsResult.error.message });
      return;
    }

    onOpenChange(false);
    await onImported(
      transactionsResult.value.length,
      preview.summary.duplicateRows + preview.summary.invalidRows + preview.summary.emptyRows,
    );
  };

  return (
    <Dialog open={open} onOpenChange={isImporting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            Select a CSV, map columns, then review which transactions will be created or skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={isPickingFile} onClick={selectFile}>
              {isPickingFile ? "Selecting..." : "Select CSV file"}
            </Button>
            {file ? (
              <p className="break-all text-xs text-muted-foreground">{file.path}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No CSV selected.</p>
            )}
          </div>

          {file && preview ? (
            <>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="transaction-import-header-row">
                    Rows to skip before header
                  </FieldLabel>
                  <Input
                    id="transaction-import-header-row"
                    type="number"
                    min={0}
                    value={headerRowIndex}
                    onChange={(event) => changeHeaderRow(event.target.value)}
                  />
                  <FieldDescription>
                    The selected row becomes the header. Data starts on the next row.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>Date format</FieldLabel>
                  <Select
                    items={DATE_FORMAT_OPTIONS}
                    value={dateFormat}
                    onValueChange={(value) => setDateFormat(value as TransactionImportDateFormat)}
                  >
                    <SelectTrigger className="w-full" aria-label="Date format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {DATE_FORMAT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Amount interpretation</FieldLabel>
                  <Select
                    items={[
                      { value: "column-type", label: "Positive amount + type column" },
                      { value: "signed", label: "Signed amount (negative = expense)" },
                    ]}
                    value={amountMode}
                    onValueChange={(value) => setAmountMode(value as TransactionImportAmountMode)}
                  >
                    <SelectTrigger className="w-full" aria-label="Amount interpretation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value="column-type">Positive amount + type column</SelectItem>
                        <SelectItem value="signed">Signed amount (negative = expense)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Missing categories</FieldLabel>
                  <Select
                    items={[
                      { value: "uncategorized", label: "Import uncategorized" },
                      { value: "create", label: "Create missing categories" },
                    ]}
                    value={missingCategoryMode}
                    onValueChange={(value) =>
                      setMissingCategoryMode(value as TransactionImportMissingCategoryMode)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Missing categories">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value="uncategorized">Import uncategorized</SelectItem>
                        <SelectItem value="create">Create missing categories</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <ColumnSelect
                  label="Amount column"
                  value={mapping.amount}
                  headers={preview.headers}
                  allowNone={false}
                  onChange={(value) => updateMapping("amount", value)}
                />
                <ColumnSelect
                  label="Date column"
                  value={mapping.transactionDate}
                  headers={preview.headers}
                  allowNone={false}
                  onChange={(value) => updateMapping("transactionDate", value)}
                />

                {amountMode === "column-type" ? (
                  <>
                    <ColumnSelect
                      label="Type column"
                      value={mapping.transactionType}
                      headers={preview.headers}
                      allowNone={false}
                      onChange={(value) => updateMapping("transactionType", value)}
                    />
                    <Field>
                      <FieldLabel htmlFor="transaction-import-expense-values">
                        Values for expense
                      </FieldLabel>
                      <Input
                        id="transaction-import-expense-values"
                        value={expenseTypeValues}
                        onChange={(event) => setExpenseTypeValues(event.target.value)}
                      />
                      <FieldDescription>Comma-separated, case-insensitive.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="transaction-import-income-values">
                        Values for income
                      </FieldLabel>
                      <Input
                        id="transaction-import-income-values"
                        value={incomeTypeValues}
                        onChange={(event) => setIncomeTypeValues(event.target.value)}
                      />
                      <FieldDescription>Comma-separated, case-insensitive.</FieldDescription>
                    </Field>
                  </>
                ) : null}

                <ColumnSelect
                  label="Description column"
                  value={mapping.description}
                  headers={preview.headers}
                  onChange={(value) => updateMapping("description", value)}
                />
                <ColumnSelect
                  label="Notes column"
                  value={mapping.notes}
                  headers={preview.headers}
                  onChange={(value) => updateMapping("notes", value)}
                />

                <Field>
                  <FieldLabel>Category source</FieldLabel>
                  <Select
                    items={[
                      { value: "columns", label: "Dedicated parent column" },
                      { value: "single-column", label: "Single column with separator" },
                    ]}
                    value={categoryLinkMode}
                    onValueChange={(value) =>
                      setCategoryLinkMode(value as TransactionImportCategoryLinkMode)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Category source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value="columns">Dedicated parent column</SelectItem>
                        <SelectItem value="single-column">Single column with separator</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <ColumnSelect
                  label={
                    categoryLinkMode === "single-column"
                      ? "Category path column"
                      : "Category name column"
                  }
                  value={mapping.categoryName}
                  headers={preview.headers}
                  onChange={(value) => updateMapping("categoryName", value)}
                />

                {categoryLinkMode === "columns" ? (
                  <ColumnSelect
                    label="Parent category column"
                    value={mapping.categoryParent}
                    headers={preview.headers}
                    onChange={(value) => updateMapping("categoryParent", value)}
                  />
                ) : (
                  <Field>
                    <FieldLabel htmlFor="transaction-import-separator">Separator</FieldLabel>
                    <Input
                      id="transaction-import-separator"
                      value={categorySeparator}
                      onChange={(event) => setCategorySeparator(event.target.value)}
                    />
                    <FieldDescription>
                      Split on first match. Example: Food - Groceries.
                    </FieldDescription>
                  </Field>
                )}
              </FieldGroup>

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
                <p>{preview.summary.importableRows} rows ready</p>
                <p>{preview.summary.categoriesToCreate} categories to create</p>
                <p>{preview.summary.duplicateRows} duplicates skipped</p>
                <p>
                  {preview.summary.invalidRows + preview.summary.emptyRows} invalid/empty skipped
                </p>
              </div>

              <TransactionImportPreviewTable
                rows={preview.rows.filter((row) => row.status === "import")}
              />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!preview || preview.transactions.length === 0 || isImporting}
            onClick={confirmImport}
          >
            {isImporting ? "Importing..." : "Confirm import"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { TransactionImportDialog };
