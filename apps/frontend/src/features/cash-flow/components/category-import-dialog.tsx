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

import { openCategoryImportFile, type CategoryImportFile } from "../commands/category-import";
import { importTransactionCategories } from "../commands/transaction-categories";
import {
  buildCategoryImportPreview,
  getDefaultCategoryImportMapping,
  parseCategoryCsv,
  type CategoryImportColumnMapping,
  type CategoryImportLinkMode,
  type CategoryImportPreviewStatus,
} from "../lib/category-import";
import type { TransactionCategory } from "../types/model";

type CategoryImportDialogProps = {
  open: boolean;
  categories: Array<TransactionCategory>;
  onOpenChange: (open: boolean) => void;
  onImported: (createdCount: number, skippedRows: number) => Promise<void>;
};

const EMPTY_COLUMN = "none";
const DEFAULT_SEPARATOR = " - ";

const statusLabels: Record<CategoryImportPreviewStatus, string> = {
  import: "Import",
  duplicate: "Skipped duplicate",
  invalid: "Skipped invalid",
  empty: "Skipped empty",
};

const getHeadersForRow = (content: string, headerRowIndex: number) =>
  parseCategoryCsv(content)[headerRowIndex] ?? [];

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

function CategoryImportPreviewTable({
  rows,
}: {
  rows: ReturnType<typeof buildCategoryImportPreview>["rows"];
}) {
  if (rows.length === 0) {
    return (
      <p className="border border-dashed p-4 text-xs text-muted-foreground">
        No data rows found after the selected header row.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto border">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            <th className="border-b px-3 py-2 font-medium">Row</th>
            <th className="border-b px-3 py-2 font-medium">Parent</th>
            <th className="border-b px-3 py-2 font-medium">Name</th>
            <th className="border-b px-3 py-2 font-medium">Color</th>
            <th className="border-b px-3 py-2 font-medium">Description</th>
            <th className="border-b px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber} className="border-b last:border-b-0">
              <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
              <td className="px-3 py-2">{row.parentName || "-"}</td>
              <td className="px-3 py-2">{row.name || "-"}</td>
              <td className="px-3 py-2">{row.color || "-"}</td>
              <td className="px-3 py-2">{row.description || "-"}</td>
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

function CategoryImportDialog({
  open,
  categories,
  onOpenChange,
  onImported,
}: CategoryImportDialogProps) {
  const [file, setFile] = useState<CategoryImportFile | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<CategoryImportColumnMapping>({
    name: null,
    parentName: null,
    color: null,
    description: null,
  });
  const [linkMode, setLinkMode] = useState<CategoryImportLinkMode>("columns");
  const [separator, setSeparator] = useState(DEFAULT_SEPARATOR);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const preview = useMemo(() => {
    if (!file) {
      return null;
    }

    return buildCategoryImportPreview(file.content, {
      headerRowIndex,
      mapping,
      linkMode,
      separator,
      existingCategories: categories,
    });
  }, [categories, file, headerRowIndex, linkMode, mapping, separator]);

  const updateMapping = (key: keyof CategoryImportColumnMapping, value: number | null) => {
    setMapping((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const selectFile = async () => {
    setIsPickingFile(true);
    const result = await openCategoryImportFile();
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
    setMapping(getDefaultCategoryImportMapping(headers));
  };

  const changeHeaderRow = (value: string) => {
    if (!file) {
      return;
    }

    const rowCount = parseCategoryCsv(file.content).length;
    const parsedValue = Number.parseInt(value, 10);
    const nextHeaderRowIndex = Number.isNaN(parsedValue)
      ? 0
      : Math.max(0, Math.min(parsedValue, Math.max(rowCount - 1, 0)));

    setHeaderRowIndex(nextHeaderRowIndex);
    setMapping(getDefaultCategoryImportMapping(getHeadersForRow(file.content, nextHeaderRowIndex)));
  };

  const importCategories = async () => {
    if (!preview || preview.categories.length === 0) {
      return;
    }

    setIsImporting(true);
    const result = await importTransactionCategories(preview.categories);
    setIsImporting(false);

    if (R.isFailure(result)) {
      toast.error("Failed to import categories", { description: result.error.message });
      return;
    }

    onOpenChange(false);
    await onImported(
      result.value.length,
      preview.summary.duplicateRows + preview.summary.invalidRows + preview.summary.emptyRows,
    );
  };

  return (
    <Dialog open={open} onOpenChange={isImporting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import categories</DialogTitle>
          <DialogDescription>
            Select a CSV, map columns, then review which categories will be created or skipped.
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
                  <FieldLabel htmlFor="category-import-header-row">
                    Rows to skip before header
                  </FieldLabel>
                  <Input
                    id="category-import-header-row"
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
                  <FieldLabel>Parent and child source</FieldLabel>
                  <Select
                    items={[
                      { value: "columns", label: "Dedicated parent column" },
                      { value: "single-column", label: "Single column with separator" },
                    ]}
                    value={linkMode}
                    onValueChange={(value) => setLinkMode(value as CategoryImportLinkMode)}
                  >
                    <SelectTrigger className="w-full" aria-label="Parent and child source">
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
                    linkMode === "single-column" ? "Category path column" : "Category name column"
                  }
                  value={mapping.name}
                  headers={preview.headers}
                  allowNone={false}
                  onChange={(value) => updateMapping("name", value)}
                />

                {linkMode === "columns" ? (
                  <ColumnSelect
                    label="Parent category column"
                    value={mapping.parentName}
                    headers={preview.headers}
                    onChange={(value) => updateMapping("parentName", value)}
                  />
                ) : (
                  <Field>
                    <FieldLabel htmlFor="category-import-separator">Separator</FieldLabel>
                    <Input
                      id="category-import-separator"
                      value={separator}
                      onChange={(event) => setSeparator(event.target.value)}
                    />
                    <FieldDescription>
                      Split on first match. Example: Food - Groceries.
                    </FieldDescription>
                  </Field>
                )}

                <ColumnSelect
                  label="Color column"
                  value={mapping.color}
                  headers={preview.headers}
                  onChange={(value) => updateMapping("color", value)}
                />
                <ColumnSelect
                  label="Description column"
                  value={mapping.description}
                  headers={preview.headers}
                  onChange={(value) => updateMapping("description", value)}
                />
              </FieldGroup>

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <p>{preview.summary.importableRows} rows ready</p>
                <p>{preview.summary.categoriesToCreate} categories to create</p>
                <p>{preview.summary.duplicateRows} duplicates skipped</p>
                <p>
                  {preview.summary.invalidRows + preview.summary.emptyRows} invalid/empty skipped
                </p>
              </div>

              <CategoryImportPreviewTable rows={preview.rows} />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!preview || preview.categories.length === 0 || isImporting}
            onClick={importCategories}
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

export { CategoryImportDialog };
