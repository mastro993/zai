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

import {
  openTransactionImportFile,
  type TransactionImportFile,
} from "../commands/transaction-import";
import { getAllTransactions, importTransactionBatch } from "../commands/transactions";
import type { ImportPreviewRowFilter } from "../lib/import-preview-filter";
import {
  buildTransactionImportPreview,
  getDefaultTransactionImportMapping,
  getDefaultTypeValueInputs,
  parseTransactionCsv,
  type TransactionImportColumnMapping,
} from "../lib/transaction-import";
import type { Transaction, TransactionCategory } from "../types/model";
import { TransactionImportMappingStep, type ImportConfig } from "./transaction-import-mapping-step";
import { TransactionImportReviewStep } from "./transaction-import-review-step";
import { TransactionImportSourceStep } from "./transaction-import-source-step";
import { ImportStepper, type ImportStep } from "./import-stepper";

type TransactionImportDialogProps = {
  open: boolean;
  categories: Array<TransactionCategory>;
  onOpenChange: (open: boolean) => void;
  onImported: (createdCount: number, skippedRows: number) => Promise<void>;
};

const EMPTY_MAPPING: TransactionImportColumnMapping = {
  amount: null,
  transactionDate: null,
  transactionType: null,
  description: null,
  notes: null,
  categoryName: null,
  categoryParent: null,
};

const createDefaultConfig = (): ImportConfig => {
  const typeValues = getDefaultTypeValueInputs();

  return {
    headerRowIndex: 0,
    amountMode: "column-type",
    dateFormat: "YYYY-MM-DD",
    categoryLinkMode: "columns",
    categorySeparator: " - ",
    missingCategoryMode: "uncategorized",
    expenseTypeValues: typeValues.expenseTypeValues,
    incomeTypeValues: typeValues.incomeTypeValues,
  };
};

function TransactionImportDialog({
  open,
  categories,
  onOpenChange,
  onImported,
}: TransactionImportDialogProps) {
  const [file, setFile] = useState<TransactionImportFile | null>(null);
  const [existingTransactions, setExistingTransactions] = useState<Array<Transaction>>([]);
  const [isLoadingExistingTransactions, setIsLoadingExistingTransactions] = useState(false);
  const [mapping, setMapping] = useState<TransactionImportColumnMapping>(EMPTY_MAPPING);
  const [config, setConfig] = useState<ImportConfig>(createDefaultConfig);
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

  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;
    setIsLoadingExistingTransactions(true);

    void getAllTransactions().then((result) => {
      if (!isActive) {
        return;
      }

      if (R.isFailure(result)) {
        toast.error("Failed to load existing transactions", {
          description: result.error.message,
        });
        setExistingTransactions([]);
      } else {
        setExistingTransactions(result.value);
      }

      setIsLoadingExistingTransactions(false);
    });

    return () => {
      isActive = false;
    };
  }, [open]);

  const rowCount = useMemo(() => (file ? parseTransactionCsv(file.content).length : 0), [file]);

  const headers = useMemo(
    () => (file ? (parseTransactionCsv(file.content)[config.headerRowIndex] ?? []) : []),
    [file, config.headerRowIndex],
  );

  const preview = useMemo(() => {
    if (!file) {
      return null;
    }

    return buildTransactionImportPreview(file.content, {
      headerRowIndex: config.headerRowIndex,
      mapping,
      amountMode: config.amountMode,
      dateFormat: config.dateFormat,
      categoryLinkMode: config.categoryLinkMode,
      categorySeparator: config.categorySeparator,
      missingCategoryMode: config.missingCategoryMode,
      expenseTypeValues: config.expenseTypeValues,
      incomeTypeValues: config.incomeTypeValues,
      existingCategories: categories,
      existingTransactions,
    });
  }, [file, config, mapping, categories, existingTransactions]);

  const mappingReady =
    mapping.amount !== null &&
    mapping.transactionDate !== null &&
    (config.amountMode !== "column-type" || mapping.transactionType !== null);

  const canAdvance =
    step === 0
      ? file !== null
      : step === 1
        ? mappingReady && !isLoadingExistingTransactions
        : false;

  const updateConfig = (patch: Partial<ImportConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const updateMapping = (key: keyof TransactionImportColumnMapping, value: number | null) => {
    setMapping((current) => ({ ...current, [key]: value }));
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

    const nextHeaders = parseTransactionCsv(result.value.content)[0] ?? [];
    setFile(result.value);
    setConfig((current) => ({ ...current, headerRowIndex: 0 }));
    setMapping(getDefaultTransactionImportMapping(nextHeaders));
  };

  const changeHeaderRow = (value: string) => {
    if (!file) {
      return;
    }

    const rows = parseTransactionCsv(file.content);
    const parsedValue = Number.parseInt(value, 10);
    const nextHeaderRowIndex = Number.isNaN(parsedValue)
      ? 0
      : Math.max(0, Math.min(parsedValue, Math.max(rows.length - 1, 0)));

    setConfig((current) => ({ ...current, headerRowIndex: nextHeaderRowIndex }));
    setMapping(getDefaultTransactionImportMapping(rows[nextHeaderRowIndex] ?? []));
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
    if (!preview || !file || preview.transactions.length === 0) {
      return;
    }

    setIsImporting(true);

    const latestTransactionsResult = await getAllTransactions();
    if (R.isFailure(latestTransactionsResult)) {
      setIsImporting(false);
      toast.error("Failed to refresh duplicate check", {
        description: latestTransactionsResult.error.message,
      });
      return;
    }

    const refreshedPreview = buildTransactionImportPreview(file.content, {
      headerRowIndex: config.headerRowIndex,
      mapping,
      amountMode: config.amountMode,
      dateFormat: config.dateFormat,
      categoryLinkMode: config.categoryLinkMode,
      categorySeparator: config.categorySeparator,
      missingCategoryMode: config.missingCategoryMode,
      expenseTypeValues: config.expenseTypeValues,
      incomeTypeValues: config.incomeTypeValues,
      existingCategories: categories,
      existingTransactions: latestTransactionsResult.value,
    });

    setExistingTransactions(latestTransactionsResult.value);

    if (refreshedPreview.transactions.length === 0) {
      setIsImporting(false);
      toast.info("No new transactions to import", {
        description: "All rows are duplicates or invalid after refresh.",
      });
      return;
    }

    const transactionsResult = await importTransactionBatch(
      refreshedPreview.categories,
      refreshedPreview.transactions,
    );
    setIsImporting(false);

    if (R.isFailure(transactionsResult)) {
      toast.error("Failed to import transactions", {
        description: transactionsResult.error.message,
      });
      return;
    }

    onOpenChange(false);
    const serverSkippedRows =
      refreshedPreview.transactions.length - transactionsResult.value.length;
    await onImported(
      transactionsResult.value.length,
      refreshedPreview.summary.invalidRows +
        refreshedPreview.summary.emptyRows +
        refreshedPreview.summary.duplicateRows +
        serverSkippedRows,
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
        ? isLoadingExistingTransactions
          ? "Loading existing transactions for duplicate check…"
          : mappingReady
            ? "Columns mapped — ready to preview"
            : "Map the required columns to continue"
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
            Import transactions
          </DialogTitle>
          <DialogDescription>
            Bring in transactions from a CSV file in three quick steps.
          </DialogDescription>
        </DialogHeader>

        <ImportStepper current={step} onStepSelect={goToStep} />

        <div className="min-h-0 overflow-y-auto pr-1">
          <div key={step} className="animate-in fade-in-0 duration-150 motion-reduce:animate-none">
            {step === 0 ? (
              <TransactionImportSourceStep
                file={file}
                rowCount={rowCount}
                isPickingFile={isPickingFile}
                onSelectFile={selectFile}
              />
            ) : null}

            {step === 1 && file ? (
              <TransactionImportMappingStep
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
              <TransactionImportReviewStep
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
                disabled={!preview || preview.transactions.length === 0 || isImporting}
              >
                {isImporting
                  ? "Importing…"
                  : `Import ${(preview?.transactions.length ?? 0).toLocaleString()} transactions`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { TransactionImportDialog };
