import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  filterImportPreviewRows,
  getImportPreviewEmptyMessage,
  IMPORT_PREVIEW_ROW_FILTER_OPTIONS,
  type ImportPreviewRowFilter,
} from "../lib/import-preview-filter";
import type { CategoryImportPreview, CategoryImportPreviewStatus } from "../lib/category-import";

const STATUS_META: Record<CategoryImportPreviewStatus, { label: string; dot: string }> = {
  import: { label: "Ready", dot: "bg-primary" },
  duplicate: { label: "Duplicate", dot: "bg-muted-foreground/50" },
  invalid: { label: "Invalid", dot: "bg-destructive" },
  empty: { label: "Empty", dot: "bg-border" },
};

function StatStrip({ summary }: { summary: CategoryImportPreview["summary"] }) {
  const cells = [
    { label: "Ready", value: summary.importableRows, tone: "text-primary" },
    { label: "To create", value: summary.categoriesToCreate, tone: "text-foreground" },
    { label: "Auto parents", value: summary.autoCreatedParents, tone: "text-foreground" },
    {
      label: "Skipped",
      value: summary.duplicateRows + summary.invalidRows + summary.emptyRows,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-1.5 bg-background p-3">
          <span className="text-[0.6875rem] text-muted-foreground">{cell.label}</span>
          <span className={cn("text-lg leading-none font-medium tabular-nums", cell.tone)}>
            {cell.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewFilter({
  value,
  onChange,
}: {
  value: ImportPreviewRowFilter;
  onChange: (value: ImportPreviewRowFilter) => void;
}) {
  return (
    <div className="inline-flex border border-border" role="group" aria-label="Filter preview rows">
      {IMPORT_PREVIEW_ROW_FILTER_OPTIONS.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 px-2.5 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-ring",
              index > 0 && "border-l border-border",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryImportReviewStep({
  preview,
  previewFilter,
  onPreviewFilterChange,
}: {
  preview: CategoryImportPreview;
  previewFilter: ImportPreviewRowFilter;
  onPreviewFilterChange: (value: ImportPreviewRowFilter) => void;
}) {
  const rows = filterImportPreviewRows(preview.rows, previewFilter);

  return (
    <div className="flex flex-col gap-4">
      <StatStrip summary={preview.summary} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PreviewFilter value={previewFilter} onChange={onPreviewFilterChange} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length.toLocaleString()} of {preview.rows.length.toLocaleString()} rows
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {getImportPreviewEmptyMessage(previewFilter)}
        </p>
      ) : (
        <div className="max-h-[19rem] overflow-auto border border-border">
          <table className="w-full caption-bottom text-xs">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow className="hover:bg-muted">
                <TableHead className="w-12 text-muted-foreground">#</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const meta = STATUS_META[row.status];

                return (
                  <TableRow
                    key={row.rowNumber}
                    className={cn(row.status === "invalid" && "bg-destructive/5")}
                  >
                    <TableCell className="text-muted-foreground tabular-nums">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate" title={row.parentName}>
                      {row.parentName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={row.name}>
                      {row.name || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.color || "—"}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={row.description}>
                      {row.description || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", meta.dot)}
                          aria-hidden
                        />
                        <span className="font-medium">{meta.label}</span>
                      </span>
                      {row.message ? (
                        <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                          {row.message}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      )}
    </div>
  );
}
