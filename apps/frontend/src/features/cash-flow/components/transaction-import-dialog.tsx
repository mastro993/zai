import { Result } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/toaster/toast";

import {
  openTransactionImportFile,
  type TransactionImportFile,
} from "../commands/transaction-import";
import { findExistingDuplicateKeys, importTransactionBatch } from "../commands/transactions";
import type { ImportPreviewRowFilter } from "../lib/import-preview-filter";
import {
  buildTransactionImportPreview,
  collectImportDuplicateCandidates,
  getDefaultTransactionImportMapping,
  getDefaultTypeValueInputs,
  parseTransactionCsv,
  type TransactionImportColumnMapping,
} from "../lib/transaction-import";
import type { TransactionCategory } from "../types/model";
import { ImportWizardDialog } from "./import-wizard-dialog";
import type { ImportStep } from "./import-stepper";
import { TransactionImportMappingStep, type ImportConfig } from "./transaction-import-mapping-step";
import { TransactionImportReviewStep } from "./transaction-import-review-step";
import { TransactionImportSourceStep } from "./transaction-import-source-step";

interface TransactionImportDialogProps {
  open: boolean;
  categories: Array<TransactionCategory>;
  onOpenChange: (open: boolean) => void;
  onImported: (createdCount: number, skippedRows: number) => Promise<void>;
}

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
  const [existingDuplicateKeys, setExistingDuplicateKeys] = useState<Array<string>>([]);
  const [isLoadingDuplicateKeys, setIsLoadingDuplicateKeys] = useState(false);
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

  const mappingReady =
    mapping.amount !== null &&
    mapping.transactionDate !== null &&
    (config.amountMode !== "column-type" || mapping.transactionType !== null);

  useEffect(() => {
    if (!open || !file || !mappingReady) {
      return;
    }

    let isActive = true;
    setIsLoadingDuplicateKeys(true);

    const candidates = collectImportDuplicateCandidates(file.content, {
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
    });

    void findExistingDuplicateKeys(candidates).then((result) => {
      if (!isActive) {
        return;
      }

      if (Result.isFailure(result)) {
        toast.error("Failed to check existing transactions", {
          description: result.error.message,
        });
        setExistingDuplicateKeys([]);
      } else {
        setExistingDuplicateKeys(result.value);
      }

      setIsLoadingDuplicateKeys(false);
    });

    return () => {
      isActive = false;
    };
  }, [open, file, mappingReady, mapping, config, categories]);

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
      existingDuplicateKeys,
    });
  }, [file, config, mapping, categories, existingDuplicateKeys]);

  const canAdvance =
    step === 0 ? file !== null : step === 1 ? mappingReady && !isLoadingDuplicateKeys : false;

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

    if (Result.isFailure(result)) {
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
    setExistingDuplicateKeys([]);
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

    const transactionsResult = await importTransactionBatch(
      preview.categories,
      preview.transactions,
    );
    setIsImporting(false);

    if (Result.isFailure(transactionsResult)) {
      toast.error("Failed to import transactions", {
        description: transactionsResult.error.message,
      });
      return;
    }

    onOpenChange(false);
    const serverSkippedRows = preview.transactions.length - transactionsResult.value.length;
    await onImported(
      transactionsResult.value.length,
      preview.summary.invalidRows +
        preview.summary.emptyRows +
        preview.summary.duplicateRows +
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
        ? isLoadingDuplicateKeys
          ? "Checking for duplicate transactions…"
          : mappingReady
            ? "Columns mapped — ready to preview"
            : "Map the required columns to continue"
        : `${importableRows.toLocaleString()} ready · ${skippedRows.toLocaleString()} skipped`;

  return (
    <ImportWizardDialog
      open={open}
      onOpenChange={onOpenChange}
      isBusy={isImporting}
      title="Import transactions"
      description="Bring in transactions from a CSV file in three quick steps."
      step={step}
      onStepSelect={goToStep}
      onBack={goBack}
      onNext={goNext}
      onCancel={() => onOpenChange(false)}
      onConfirm={confirmImport}
      canAdvance={canAdvance}
      isImporting={isImporting}
      footerHint={footerHint}
      confirmLabel={`Import ${(preview?.transactions.length ?? 0).toLocaleString()} transactions`}
      confirmDisabled={!preview || preview.transactions.length === 0}
      renderStep={(currentStep) => {
        if (currentStep === 0) {
          return (
            <TransactionImportSourceStep
              file={file}
              rowCount={rowCount}
              isPickingFile={isPickingFile}
              onSelectFile={selectFile}
            />
          );
        }

        if (currentStep === 1 && file) {
          return (
            <TransactionImportMappingStep
              headers={headers}
              mapping={mapping}
              config={config}
              mappingReady={mappingReady}
              onMappingChange={updateMapping}
              onConfigChange={updateConfig}
              onHeaderRowChange={changeHeaderRow}
            />
          );
        }

        if (currentStep === 2 && preview) {
          return (
            <TransactionImportReviewStep
              preview={preview}
              previewFilter={previewFilter}
              onPreviewFilterChange={setPreviewFilter}
            />
          );
        }

        return null;
      }}
    />
  );
}

export { TransactionImportDialog };
