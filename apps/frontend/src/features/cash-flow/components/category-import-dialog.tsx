import { R } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, FileImportIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { openCategoryImportFile, type CategoryImportFile } from "../commands/category-import";
import { importTransactionCategories } from "../commands/transaction-categories";
import type { ImportPreviewRowFilter } from "../lib/import-preview-filter";
import {
  buildCategoryImportPreview,
  getDefaultCategoryImportMapping,
  parseCategoryCsv,
  type CategoryImportColumnMapping,
} from "../lib/category-import";
import type { TransactionCategory } from "../types/model";
import {
  CategoryImportMappingStep,
  type CategoryImportConfig,
} from "./category-import-mapping-step";
import { CategoryImportReviewStep } from "./category-import-review-step";
import { CategoryImportSourceStep } from "./category-import-source-step";
import { ImportStepper, type ImportStep } from "./import-stepper";

type CategoryImportDialogProps = {
  open: boolean;
  categories: Array<TransactionCategory>;
  onOpenChange: (open: boolean) => void;
  onImported: (createdCount: number, skippedRows: number) => Promise<void>;
};

const EMPTY_MAPPING: CategoryImportColumnMapping = {
  name: null,
  parentName: null,
  color: null,
  description: null,
};

const createDefaultConfig = (): CategoryImportConfig => ({
  headerRowIndex: 0,
  linkMode: "columns",
  separator: " - ",
});

function CategoryImportDialog({
  open,
  categories,
  onOpenChange,
  onImported,
}: CategoryImportDialogProps) {
  const [file, setFile] = useState<CategoryImportFile | null>(null);
  const [mapping, setMapping] = useState<CategoryImportColumnMapping>(EMPTY_MAPPING);
  const [config, setConfig] = useState<CategoryImportConfig>(createDefaultConfig);
  const [step, setStep] = useState<ImportStep>(0);
  const [previewFilter, setPreviewFilter] = useState<ImportPreviewRowFilter>("importable");
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setPreviewFilter("importable");
    }
  }, [open]);

  const rowCount = useMemo(() => (file ? parseCategoryCsv(file.content).length : 0), [file]);

  const headers = useMemo(
    () => (file ? (parseCategoryCsv(file.content)[config.headerRowIndex] ?? []) : []),
    [file, config.headerRowIndex],
  );

  const preview = useMemo(() => {
    if (!file) {
      return null;
    }

    return buildCategoryImportPreview(file.content, {
      headerRowIndex: config.headerRowIndex,
      mapping,
      linkMode: config.linkMode,
      separator: config.separator,
      existingCategories: categories,
    });
  }, [file, config, mapping, categories]);

  const mappingReady = mapping.name !== null;

  const canAdvance = step === 0 ? file !== null : step === 1 ? mappingReady : false;

  const updateConfig = (patch: Partial<CategoryImportConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const updateMapping = (key: keyof CategoryImportColumnMapping, value: number | null) => {
    setMapping((current) => ({ ...current, [key]: value }));
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

    const nextHeaders = parseCategoryCsv(result.value.content)[0] ?? [];
    setFile(result.value);
    setConfig((current) => ({ ...current, headerRowIndex: 0 }));
    setMapping(getDefaultCategoryImportMapping(nextHeaders));
  };

  const changeHeaderRow = (value: string) => {
    if (!file) {
      return;
    }

    const rows = parseCategoryCsv(file.content);
    const parsedValue = Number.parseInt(value, 10);
    const nextHeaderRowIndex = Number.isNaN(parsedValue)
      ? 0
      : Math.max(0, Math.min(parsedValue, Math.max(rows.length - 1, 0)));

    setConfig((current) => ({ ...current, headerRowIndex: nextHeaderRowIndex }));
    setMapping(getDefaultCategoryImportMapping(rows[nextHeaderRowIndex] ?? []));
  };

  const goNext = () => {
    if (step === 0 && file) {
      setStep(1);
    } else if (step === 1 && mappingReady) {
      setStep(2);
    }
  };

  const goBack = () => {
    setStep((current) => (current > 0 ? ((current - 1) as ImportStep) : current));
  };

  const goToStep = (target: ImportStep) => {
    if (target < step) {
      setStep(target);
    }
  };

  const confirmImport = async () => {
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

  const importableRows = preview?.summary.importableRows ?? 0;
  const skippedRows = preview
    ? preview.summary.duplicateRows + preview.summary.invalidRows + preview.summary.emptyRows
    : 0;

  const footerHint =
    step === 0
      ? file
        ? `${rowCount.toLocaleString()} rows detected`
        : "Select a CSV file to begin"
      : step === 1
        ? mappingReady
          ? "Columns mapped — ready to preview"
          : "Map a category name column to continue"
        : `${importableRows.toLocaleString()} ready · ${skippedRows.toLocaleString()} skipped`;

  return (
    <Dialog open={open} onOpenChange={isImporting ? undefined : onOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl md:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={FileImportIcon}
              className="size-4 text-muted-foreground"
              strokeWidth={1.8}
            />
            Import categories
          </DialogTitle>
          <DialogDescription>
            Bring in categories from a CSV file in three quick steps.
          </DialogDescription>
        </DialogHeader>

        <ImportStepper current={step} onStepSelect={goToStep} />

        <div className="min-h-0 overflow-y-auto pr-1">
          <div key={step} className="animate-in fade-in-0 duration-150 motion-reduce:animate-none">
            {step === 0 ? (
              <CategoryImportSourceStep
                file={file}
                rowCount={rowCount}
                isPickingFile={isPickingFile}
                onSelectFile={selectFile}
              />
            ) : null}

            {step === 1 && file ? (
              <CategoryImportMappingStep
                headers={headers}
                mapping={mapping}
                config={config}
                mappingReady={mappingReady}
                onMappingChange={updateMapping}
                onConfigChange={updateConfig}
                onHeaderRowChange={changeHeaderRow}
              />
            ) : null}

            {step === 2 && preview ? (
              <CategoryImportReviewStep
                preview={preview}
                previewFilter={previewFilter}
                onPreviewFilterChange={setPreviewFilter}
              />
            ) : null}
          </div>
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">{footerHint}</p>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={goBack} disabled={isImporting}>
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={goNext} disabled={!canAdvance}>
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={1.8} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={confirmImport}
                disabled={!preview || preview.categories.length === 0 || isImporting}
              >
                {isImporting
                  ? "Importing…"
                  : `Import ${(preview?.categories.length ?? 0).toLocaleString()} categories`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CategoryImportDialog };
