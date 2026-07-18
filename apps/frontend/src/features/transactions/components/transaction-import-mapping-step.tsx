import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Coins01Icon,
  InformationCircleIcon,
  Tag01Icon,
  TableIcon,
} from "@hugeicons/core-free-icons";

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

import type {
  TransactionImportAmountMode,
  TransactionImportCategoryLinkMode,
  TransactionImportColumnMapping,
  TransactionImportDateFormat,
  TransactionImportMissingCategoryMode,
} from "../lib/transaction-import";

export type ImportConfig = {
  headerRowIndex: number;
  amountMode: TransactionImportAmountMode;
  dateFormat: TransactionImportDateFormat;
  categoryLinkMode: TransactionImportCategoryLinkMode;
  categorySeparator: string;
  missingCategoryMode: TransactionImportMissingCategoryMode;
  expenseTypeValues: string;
  incomeTypeValues: string;
};

const EMPTY_COLUMN = "none";

const DATE_FORMAT_OPTIONS: Array<{ value: TransactionImportDateFormat; label: string }> = [
  { value: "ISO", label: "ISO datetime (YYYY-MM-DDTHH:mm:ss)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY" },
];

const AMOUNT_MODE_OPTIONS: Array<{ value: TransactionImportAmountMode; label: string }> = [
  { value: "column-type", label: "Positive amount + type column" },
  { value: "signed", label: "Signed amount (negative = expense)" },
];

const MISSING_CATEGORY_OPTIONS: Array<{
  value: TransactionImportMissingCategoryMode;
  label: string;
}> = [
  { value: "uncategorized", label: "Import uncategorized" },
  { value: "create", label: "Create missing categories" },
];

const CATEGORY_LINK_OPTIONS: Array<{ value: TransactionImportCategoryLinkMode; label: string }> = [
  { value: "columns", label: "Dedicated parent column" },
  { value: "single-column", label: "Single column with separator" },
];

function SectionHeader({ icon, title }: { icon: typeof TableIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
      <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" strokeWidth={1.8} />
      {title}
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="text-destructive">
      *<span className="sr-only"> required</span>
    </span>
  );
}

function OptionSelect<T extends string>({
  label,
  value,
  items,
  onChange,
  description,
}: {
  label: string;
  value: T;
  items: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  description?: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(String(next) as T)}>
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
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  allowNone = true,
  required = false,
  onChange,
}: {
  label: string;
  value: number | null;
  headers: Array<string>;
  allowNone?: boolean;
  required?: boolean;
  onChange: (value: number | null) => void;
}) {
  const items = [
    ...(allowNone ? [{ value: EMPTY_COLUMN, label: "None" }] : []),
    ...headers.map((header, index) => ({
      value: String(index),
      label: header.trim() || `Column ${index + 1}`,
    })),
  ];
  const selectValue = value === null ? EMPTY_COLUMN : String(value);

  return (
    <Field>
      <FieldLabel>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      <Select
        items={items}
        value={selectValue}
        onValueChange={(next) => {
          const stringValue = String(next ?? EMPTY_COLUMN);
          onChange(stringValue === EMPTY_COLUMN ? null : Number(stringValue));
        }}
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

export function TransactionImportMappingStep({
  headers,
  mapping,
  config,
  mappingReady,
  onMappingChange,
  onConfigChange,
  onHeaderRowChange,
}: {
  headers: Array<string>;
  mapping: TransactionImportColumnMapping;
  config: ImportConfig;
  mappingReady: boolean;
  onMappingChange: (key: keyof TransactionImportColumnMapping, value: number | null) => void;
  onConfigChange: (patch: Partial<ImportConfig>) => void;
  onHeaderRowChange: (value: string) => void;
}) {
  const isColumnType = config.amountMode === "column-type";
  const isSingleColumnCategory = config.categoryLinkMode === "single-column";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader icon={TableIcon} title="Required columns" />
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            label="Amount"
            required
            allowNone={false}
            value={mapping.amount}
            headers={headers}
            onChange={(value) => onMappingChange("amount", value)}
          />
          <ColumnSelect
            label="Date"
            required
            allowNone={false}
            value={mapping.transactionDate}
            headers={headers}
            onChange={(value) => onMappingChange("transactionDate", value)}
          />
          <ColumnSelect
            label="Description"
            value={mapping.description}
            headers={headers}
            onChange={(value) => onMappingChange("description", value)}
          />
          <ColumnSelect
            label="Notes"
            value={mapping.notes}
            headers={headers}
            onChange={(value) => onMappingChange("notes", value)}
          />
        </FieldGroup>
        {mappingReady ? null : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              className="size-4 shrink-0"
              strokeWidth={1.8}
            />
            Map the amount and date columns
            {isColumnType ? ", plus a type column," : ""} to review your import.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader icon={Coins01Icon} title="Amount & date parsing" />
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="transaction-import-header-row">
              Rows to skip before header
            </FieldLabel>
            <Input
              id="transaction-import-header-row"
              type="number"
              min={0}
              value={config.headerRowIndex}
              onChange={(event) => onHeaderRowChange(event.target.value)}
            />
            <FieldDescription>
              The selected row becomes the header; data starts after it.
            </FieldDescription>
          </Field>
          <OptionSelect
            label="Date format"
            value={config.dateFormat}
            items={DATE_FORMAT_OPTIONS}
            onChange={(value) => onConfigChange({ dateFormat: value })}
          />
          <OptionSelect
            label="Amount interpretation"
            value={config.amountMode}
            items={AMOUNT_MODE_OPTIONS}
            onChange={(value) => onConfigChange({ amountMode: value })}
          />
          {isColumnType ? (
            <ColumnSelect
              label="Type"
              required
              allowNone={false}
              value={mapping.transactionType}
              headers={headers}
              onChange={(value) => onMappingChange("transactionType", value)}
            />
          ) : null}
          {isColumnType ? (
            <>
              <Field>
                <FieldLabel htmlFor="transaction-import-expense-values">
                  Values for expense
                </FieldLabel>
                <Input
                  id="transaction-import-expense-values"
                  value={config.expenseTypeValues}
                  onChange={(event) => onConfigChange({ expenseTypeValues: event.target.value })}
                />
                <FieldDescription>Comma-separated, case-insensitive.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="transaction-import-income-values">
                  Values for income
                </FieldLabel>
                <Input
                  id="transaction-import-income-values"
                  value={config.incomeTypeValues}
                  onChange={(event) => onConfigChange({ incomeTypeValues: event.target.value })}
                />
                <FieldDescription>Comma-separated, case-insensitive.</FieldDescription>
              </Field>
            </>
          ) : null}
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader icon={Tag01Icon} title="Categories" />
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <OptionSelect
            label="Category source"
            value={config.categoryLinkMode}
            items={CATEGORY_LINK_OPTIONS}
            onChange={(value) => onConfigChange({ categoryLinkMode: value })}
          />
          <ColumnSelect
            label={isSingleColumnCategory ? "Category path column" : "Category name column"}
            value={mapping.categoryName}
            headers={headers}
            onChange={(value) => onMappingChange("categoryName", value)}
          />
          {isSingleColumnCategory ? (
            <Field>
              <FieldLabel htmlFor="transaction-import-separator">Separator</FieldLabel>
              <Input
                id="transaction-import-separator"
                value={config.categorySeparator}
                onChange={(event) => onConfigChange({ categorySeparator: event.target.value })}
              />
              <FieldDescription>Split on first match. Example: Food - Groceries.</FieldDescription>
            </Field>
          ) : (
            <ColumnSelect
              label="Parent category column"
              value={mapping.categoryParent}
              headers={headers}
              onChange={(value) => onMappingChange("categoryParent", value)}
            />
          )}
          <OptionSelect
            label="Missing categories"
            value={config.missingCategoryMode}
            items={MISSING_CATEGORY_OPTIONS}
            onChange={(value) => onConfigChange({ missingCategoryMode: value })}
          />
        </FieldGroup>
      </section>
    </div>
  );
}
