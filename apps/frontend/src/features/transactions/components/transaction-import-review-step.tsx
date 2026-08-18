import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatAmountFromMinor } from "../lib/transaction";
import { isoFractionDigits } from "@/lib/currency";

import {
  filterImportPreviewRows,
  getImportPreviewEmptyMessage,
  IMPORT_PREVIEW_ROW_FILTER_OPTIONS,
  type ImportPreviewRowFilter,
} from "@/lib/import-preview-filter";
import type {
  BoundImportPreview,
  CurrencyPrepAction,
  ImportPreviewRowResult,
} from "../types/import";
import { TransactionTypeBadge } from "./transaction-type-badge";

interface ImportStatusMeta {
  label: string;
  dot: string;
}

const STATUS_META = {
  import: { label: "Ready", dot: "bg-primary" },
  duplicate: { label: "Duplicate", dot: "bg-muted-foreground/50" },
  invalid: { label: "Invalid", dot: "bg-destructive" },
  empty: { label: "Empty", dot: "bg-border" },
} satisfies Record<ImportPreviewRowResult["status"], ImportStatusMeta>;

const PREP_ACTION_LABEL: Record<CurrencyPrepAction, string> = {
  alreadyEnabled: "already enabled",
  add: "add",
  reEnable: "re-enable",
  backfill: "backfill",
};

function coverageLabel(from: string | undefined, to: string | undefined) {
  if (!from && !to) {
    return "no coverage yet";
  }
  return `${from ?? "—"} – ${to ?? "—"}`;
}

function StatStrip({ summary }: { summary: BoundImportPreview["summary"] }) {
  const cells = [
    { label: "Ready", value: summary.importableRows, tone: "text-primary" },
    { label: "New categories", value: summary.categoriesToCreate, tone: "text-foreground" },
    { label: "Skipped", value: summary.duplicateRows + summary.emptyRows, tone: "text-foreground" },
    {
      label: "Invalid",
      value: summary.invalidRows,
      tone: summary.blocked ? "text-destructive" : "text-foreground",
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

function formatPreviewAmount(row: ImportPreviewRowResult) {
  if (row.amountMinor === undefined || !row.currency) {
    return "—";
  }
  return formatAmountFromMinor(row.amountMinor, isoFractionDigits(row.currency));
}

export function TransactionImportReviewStep({
  preview,
  previewFilter,
  onPreviewFilterChange,
}: {
  preview: BoundImportPreview;
  previewFilter: ImportPreviewRowFilter;
  onPreviewFilterChange: (value: ImportPreviewRowFilter) => void;
}) {
  const rows = filterImportPreviewRows(preview.rows, previewFilter);

  return (
    <div className="flex flex-col gap-4">
      {preview.currencyPreparations.length > 0 ? (
        <section className="flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h2 className="font-heading text-xl font-semibold">
              Currencies this import will prepare
            </h2>
            <p className="text-sm text-muted-foreground">
              Review every add, re-enable, and backfill before the atomic import.
            </p>
          </header>
          <ol className="flex flex-col gap-2">
            {preview.currencyPreparations.map((need, index) => (
              <li key={need.code} className="flex items-start gap-3 border border-border p-3">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                <div className="flex-1">
                  <p className="font-medium">
                    {need.name} ({need.code})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {PREP_ACTION_LABEL[need.action]} ·{" "}
                    {coverageLabel(need.coverageFrom, need.coverageTo)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {preview.summary.blocked ? (
        <p role="alert" className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          Invalid rows block this import. Empty rows and duplicates are skipped; everything else
          must be valid.
        </p>
      ) : null}

      {preview.job.status === "running" ? (
        <p className="text-sm text-muted-foreground">Proving currency coverage…</p>
      ) : null}

      {preview.job.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {preview.job.error?.message ?? "Import preview failed"}
        </p>
      ) : null}

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
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
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
                    <TableCell className="tabular-nums">{row.transactionDate || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPreviewAmount(row)}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.currency || "—"}</TableCell>
                    <TableCell>
                      {row.transactionType === "expense" || row.transactionType === "income" ? (
                        <TransactionTypeBadge type={row.transactionType} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate" title={row.description}>
                      {row.description || "—"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={row.category}>
                      {row.category || "—"}
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
