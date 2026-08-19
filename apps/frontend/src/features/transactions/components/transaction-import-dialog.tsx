import { CommandError } from "@/commands/errors";
import { Result } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/toaster/toast";

import {
  openTransactionImportFile,
  type TransactionImportFile,
} from "../commands/transaction-import";
import {
  commitTransactionImport,
  getTransactionImportPreview,
  previewTransactionImport,
} from "../commands/transactions";
import type { ImportPreviewRowFilter } from "@/lib/import-preview-filter";
import {
  digestTransactionImportFile,
  getDefaultTransactionImportMapping,
  getDefaultTypeValueInputs,
  isZaiTransactionExport,
  mapTransactionImportRows,
  parseTransactionCsv,
  type TransactionImportColumnMapping,
} from "../lib/transaction-import";
import type { BoundImportPreview } from "../types/import";
import type { TransactionCategory } from "@/features/categories/types/model";
import { useCurrencyBootstrap } from "@/features/currency/hooks/use-currency-bootstrap";
import { ImportWizardDialog } from "@/components/import-wizard-dialog";
import { previousImportStep, type ImportStep } from "@/components/import-stepper";
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
  amountMinor: null,
  currency: null,
  transactionDate: null,
  transactionType: null,
  description: null,
  notes: null,
  categoryName: null,
  categoryParent: null,
  rate: null,
  rateDate: null,
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const waitForPreviewJob = async (
  token: string,
  attempt = 0,
): Promise<Result.Result<BoundImportPreview, CommandError>> => {
  const result = await getTransactionImportPreview(token);
  if (Result.isFailure(result) || result.value.job.status !== "running") {
    return result;
  }
  if (attempt >= 79) {
    return Result.fail(new CommandError("Import preview timed out"));
  }
  await sleep(250);
  return waitForPreviewJob(token, attempt + 1);
};

function TransactionImportDialog({
  open,
  categories,
  onOpenChange,
  onImported,
}: TransactionImportDialogProps) {
  const { defaultCurrency, catalog } = useCurrencyBootstrap();
  const [file, setFile] = useState<TransactionImportFile | null>(null);
  const [fileDigest, setFileDigest] = useState<string | null>(null);
  const [mapping, setMapping] = useState<TransactionImportColumnMapping>(EMPTY_MAPPING);
  const [config, setConfig] = useState<ImportConfig>(() => {
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
      confirmedTransactionCurrency: "",
      rateDirection: "transactionToDefault",
    };
  });
  const [step, setStep] = useState<ImportStep>(0);
  const [previewFilter, setPreviewFilter] = useState<ImportPreviewRowFilter>("importable");
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<BoundImportPreview | null>(null);
  const [needsProviderDisclosure, setNeedsProviderDisclosure] = useState(false);
  const [confirmProviderDisclosure, setConfirmProviderDisclosure] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setPreviewFilter("importable");
      setPreview(null);
      setNeedsProviderDisclosure(false);
      setConfirmProviderDisclosure(false);
    }
  }, [open]);

  useEffect(() => {
    if (!config.confirmedTransactionCurrency && defaultCurrency) {
      setConfig((current) => ({ ...current, confirmedTransactionCurrency: defaultCurrency }));
    }
  }, [config.confirmedTransactionCurrency, defaultCurrency]);

  const headers = useMemo(
    () => (file ? (parseTransactionCsv(file.content)[config.headerRowIndex] ?? []) : []),
    [file, config.headerRowIndex],
  );
  const zaiExport = isZaiTransactionExport(headers);
  const hasCurrencyColumn = mapping.currency !== null || zaiExport;
  const isSignedAmountMode = config.amountMode === "signed";
  const amountMapped = isSignedAmountMode
    ? mapping.amount !== null
    : mapping.amount !== null || mapping.amountMinor !== null;
  const mappingReady =
    amountMapped &&
    mapping.transactionDate !== null &&
    (config.amountMode !== "column-type" || mapping.transactionType !== null) &&
    (hasCurrencyColumn || config.confirmedTransactionCurrency.length === 3);

  const rowCount = useMemo(() => (file ? parseTransactionCsv(file.content).length : 0), [file]);

  const canAdvance =
    step === 0 ? file !== null : step === 1 ? mappingReady && !isPreviewing : false;

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

    const digestResult = await digestTransactionImportFile(result.value.content);
    if (Result.isFailure(digestResult)) {
      toast.error("Failed to hash CSV file", { description: digestResult.error.message });
      return;
    }

    const nextHeaders = parseTransactionCsv(result.value.content)[0] ?? [];
    setFile(result.value);
    setFileDigest(digestResult.value);
    setPreview(null);
    setConfig((current) => ({
      ...current,
      headerRowIndex: 0,
      dateFormat: isZaiTransactionExport(nextHeaders) ? "ISO" : current.dateFormat,
    }));
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
    setPreview(null);
  };

  const loadPreview = async () => {
    if (!file || !fileDigest || !mappingReady) {
      return false;
    }

    setIsPreviewing(true);
    const mapped = mapTransactionImportRows(file.content, {
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
      confirmedTransactionCurrency: hasCurrencyColumn
        ? undefined
        : config.confirmedTransactionCurrency,
      rateDirection: config.rateDirection,
    });

    const result = await previewTransactionImport({
      fileDigest,
      hasCurrencyColumn: mapped.hasCurrencyColumn,
      confirmedTransactionCurrency: mapped.hasCurrencyColumn
        ? undefined
        : config.confirmedTransactionCurrency,
      confirmProviderDisclosure,
      rows: mapped.rows,
    });

    if (Result.isFailure(result) && result.error.code === "providerDisclosureRequired") {
      setNeedsProviderDisclosure(true);
      setIsPreviewing(false);
      toast.error("Confirm ECB rate retrieval to prepare currencies in this import");
      return false;
    }

    if (Result.isFailure(result)) {
      setIsPreviewing(false);
      toast.error("Failed to preview import", { description: result.error.message });
      return false;
    }

    let nextPreview = result.value;
    if (nextPreview.job.status === "running") {
      const waited = await waitForPreviewJob(nextPreview.token);
      if (Result.isFailure(waited)) {
        setIsPreviewing(false);
        toast.error("Failed to preview import", { description: waited.error.message });
        return false;
      }
      nextPreview = waited.value;
    }

    setPreview(nextPreview);
    setIsPreviewing(false);
    return true;
  };

  const goNext = () => {
    if (step === 0 && file) {
      setStep(1);
      return;
    }
    if (step === 1 && mappingReady) {
      void loadPreview().then((ok) => {
        if (ok) {
          setStep(2);
        }
      });
    }
  };

  const goBack = () => {
    setStep((current) => previousImportStep(current));
  };

  const goToStep = (target: ImportStep) => {
    if (target < step) {
      setStep(target);
    }
  };

  const confirmImport = async () => {
    if (
      !preview ||
      !fileDigest ||
      preview.summary.blocked ||
      preview.summary.importableRows === 0
    ) {
      return;
    }
    if (preview.job.status !== "succeeded") {
      return;
    }

    setIsImporting(true);
    const result = await commitTransactionImport({
      token: preview.token,
      fileDigest,
    });
    setIsImporting(false);

    if (Result.isFailure(result)) {
      toast.error("Failed to import transactions", {
        description: result.error.message,
      });
      return;
    }

    onOpenChange(false);
    await onImported(
      result.value.transactions.length,
      preview.summary.invalidRows + preview.summary.emptyRows + preview.summary.duplicateRows,
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
        ? isPreviewing
          ? "Preparing import preview…"
          : mappingReady
            ? "Columns mapped — ready to preview"
            : "Map the required columns to continue"
        : `${importableRows.toLocaleString()} ready · ${skippedRows.toLocaleString()} skipped`;

  const confirmDisabled =
    !preview ||
    preview.summary.blocked ||
    preview.summary.importableRows === 0 ||
    preview.job.status !== "succeeded";

  return (
    <ImportWizardDialog
      open={open}
      onOpenChange={onOpenChange}
      isBusy={isImporting || isPreviewing}
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
      confirmLabel={`Import ${importableRows.toLocaleString()} transactions`}
      confirmDisabled={confirmDisabled}
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
              catalog={catalog}
              isZaiExport={zaiExport}
              needsProviderDisclosure={needsProviderDisclosure}
              confirmProviderDisclosure={confirmProviderDisclosure}
              onMappingChange={updateMapping}
              onConfigChange={updateConfig}
              onHeaderRowChange={changeHeaderRow}
              onConfirmProviderDisclosureChange={setConfirmProviderDisclosure}
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
