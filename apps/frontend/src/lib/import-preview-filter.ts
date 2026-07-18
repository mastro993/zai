export type ImportPreviewRowFilter = "importable" | "skipped" | "all";

export const IMPORT_PREVIEW_ROW_FILTER_OPTIONS: Array<{
  value: ImportPreviewRowFilter;
  label: string;
}> = [
  { value: "importable", label: "Importable rows" },
  { value: "skipped", label: "Skipped rows" },
  { value: "all", label: "All rows" },
];

export const filterImportPreviewRows = <TRow extends { status: string }>(
  rows: Array<TRow>,
  filter: ImportPreviewRowFilter,
) => {
  if (filter === "all") {
    return rows;
  }

  if (filter === "skipped") {
    return rows.filter((row) => row.status !== "import");
  }

  return rows.filter((row) => row.status === "import");
};

export const getImportPreviewEmptyMessage = (filter: ImportPreviewRowFilter) => {
  if (filter === "skipped") {
    return "No skipped rows.";
  }

  if (filter === "all") {
    return "No rows found after the selected header row.";
  }

  return "No importable rows. Switch the preview filter to review skipped rows.";
};
