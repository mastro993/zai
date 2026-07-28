import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, TableIcon, Tag01Icon } from "@hugeicons/core-free-icons";

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

import type { CategoryImportColumnMapping, CategoryImportLinkMode } from "../lib/category-import";

export type CategoryImportConfig = {
  headerRowIndex: number;
  linkMode: CategoryImportLinkMode;
  separator: string;
};

const EMPTY_COLUMN = "none";

const LINK_MODE_OPTIONS: Array<{ value: CategoryImportLinkMode; label: string }> = [
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

export function CategoryImportMappingStep({
  headers,
  mapping,
  config,
  mappingReady,
  onMappingChange,
  onConfigChange,
  onHeaderRowChange,
}: {
  headers: Array<string>;
  mapping: CategoryImportColumnMapping;
  config: CategoryImportConfig;
  mappingReady: boolean;
  onMappingChange: (key: keyof CategoryImportColumnMapping, value: number | null) => void;
  onConfigChange: (patch: Partial<CategoryImportConfig>) => void;
  onHeaderRowChange: (value: string) => void;
}) {
  const isSingleColumn = config.linkMode === "single-column";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader icon={TableIcon} title="File structure" />
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="category-import-header-row">Rows to skip before header</FieldLabel>
            <Input
              id="category-import-header-row"
              type="number"
              min={0}
              value={config.headerRowIndex}
              onChange={(event) => onHeaderRowChange(event.target.value)}
            />
            <FieldDescription>
              The selected row becomes the header; data starts after it.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader icon={Tag01Icon} title="Category columns" />
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <OptionSelect
            label="Parent and child source"
            value={config.linkMode}
            items={LINK_MODE_OPTIONS}
            onChange={(value) => onConfigChange({ linkMode: value })}
          />
          <ColumnSelect
            label={isSingleColumn ? "Category path column" : "Category name column"}
            required
            allowNone={false}
            value={mapping.name}
            headers={headers}
            onChange={(value) => onMappingChange("name", value)}
          />
          {isSingleColumn ? (
            <Field>
              <FieldLabel htmlFor="category-import-separator">Separator</FieldLabel>
              <Input
                id="category-import-separator"
                value={config.separator}
                onChange={(event) => onConfigChange({ separator: event.target.value })}
              />
              <FieldDescription>Split on first match. Example: Food - Groceries.</FieldDescription>
            </Field>
          ) : (
            <ColumnSelect
              label="Parent category column"
              value={mapping.parentName}
              headers={headers}
              onChange={(value) => onMappingChange("parentName", value)}
            />
          )}
          <ColumnSelect
            label="Color column"
            value={mapping.color}
            headers={headers}
            onChange={(value) => onMappingChange("color", value)}
          />
          <ColumnSelect
            label="Description column"
            value={mapping.description}
            headers={headers}
            onChange={(value) => onMappingChange("description", value)}
          />
        </FieldGroup>
        {mappingReady ? null : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              className="size-4 shrink-0"
              strokeWidth={1.8}
            />
            Map a category name column to review your import.
          </p>
        )}
      </section>
    </div>
  );
}
