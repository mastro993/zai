import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { exportDataToFile } from "@/lib/export";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTransactionCategories } from "../api/useTransactionCategories";
type TransactionCategoryExportModalProps = InjectedModalProps;

export const TransactionCategoryExportModal = (
  props: TransactionCategoryExportModalProps
) => {
  const { data } = useTransactionCategories();
  const [isExporting, setIsExporting] = useState(false);

  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv");

  const exportData = useCallback(async () => {
    if (!data || isExporting) {
      return;
    }

    const formattedDate = dayjs().format("YYYY-MM-DDT-HH-mm-ss");
    const defaultPath = `spiccy_transaction_categories_${formattedDate}.${exportFormat}`;

    const filteredData = data
      .map((category) => {
        const { id, name, color, description, parent_id } = category;
        return { id, name, color, description, parent_id };
      })
      .map((category) => {
        return Object.fromEntries(
          Object.entries(category).filter(([_, value]) => value !== null)
        );
      });

    setIsExporting(true);
    const success = await exportDataToFile({
      data: filteredData,
      defaultPath,
      format: exportFormat,
    });

    if (success) {
      toast.success("Transaction categories exported successfully");
    } else {
      toast.error("Failed to export transaction categories");
    }

    props.onDismiss?.();
  }, [data, isExporting, exportFormat]);

  return (
    <Modal
      title="Export transaction categories"
      description="Export transaction categories to a file in different formats"
      {...props}
    >
      <fieldset className="fieldset">
        <legend className="fieldset-legend">File format</legend>
        <div className="flex gap-2 items-center">
          <input
            type="radio"
            name="radio-1"
            className="radio"
            value="csv"
            onChange={() => setExportFormat("csv")}
            checked={exportFormat === "csv"}
          />
          <label htmlFor="radio-1" className="text-md">
            CSV
          </label>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="radio"
            name="radio-1"
            className="radio"
            value="json"
            onChange={() => setExportFormat("json")}
            checked={exportFormat === "json"}
          />
          <label htmlFor="radio-2" className="text-md">
            JSON
          </label>
        </div>
      </fieldset>

      <div className="flex gap-2 justify-end">
        <button
          className="btn btn-soft"
          type="reset"
          onClick={props.onDismiss}
          disabled={isExporting}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={exportData}
          disabled={isExporting}
        >
          {isExporting && (
            <span className="loading loading-spinner loading-xs" />
          )}
          Export
        </button>
      </div>
    </Modal>
  );
};
