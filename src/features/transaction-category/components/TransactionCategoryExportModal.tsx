import { Button } from "@/components/ui/Button/Button";
import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { useState } from "react";
import { toast } from "sonner";
import { useExportCategories } from "../hooks/useExportCategorites";

type TransactionCategoryExportModalProps = InjectedModalProps;

export const TransactionCategoryExportModal = (
  props: TransactionCategoryExportModalProps
) => {
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv");

  const { exportData, isExporting } = useExportCategories({
    format: exportFormat,
    onSuccess: () => {
      toast.success("Transaction categories exported successfully");
      props.onDismiss?.();
    },
    onError: () => {
      toast.error("Failed to export transaction categories");
    },
  });

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
        <Button
          variant="soft"
          onClick={props.onDismiss}
          disabled={isExporting}
          label="Cancel"
        />
        <Button
          variant="primary"
          onClick={exportData}
          disabled={isExporting}
          loading={isExporting}
          label="Export"
        />
      </div>
    </Modal>
  );
};
