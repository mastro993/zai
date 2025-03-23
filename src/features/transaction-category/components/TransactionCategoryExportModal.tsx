import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { useTransactionCategories } from "../api/useTransactionCategories";

type TransactionCategoryExportModalProps = InjectedModalProps;

export const TransactionCategoryExportModal = (
  props: TransactionCategoryExportModalProps
) => {
  const { data } = useTransactionCategories();
  const [isExporting, setIsExporting] = useState(false);

  const [exportLocation, setExportLocation] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv");

  const exportData = useCallback(async () => {
    if (!data || isExporting) {
      return;
    }

    try {
      const formattedDate = dayjs().format("YYYY-MM-DDT-HH-mm-ss");
      const defaultPath = `spiccy_transaction_categories_${formattedDate}.json`;

      const filePath = await save({
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }],
        canCreateDirectories: true,
      });

      if (filePath) {
        const cleanedData = data
          .map((category) => {
            const { id, name, color, description, parent_id } = category;
            return { id, name, color, description, parent_id };
          })
          .map((category) => {
            return Object.fromEntries(
              Object.entries(category).filter(([_, value]) => value !== null)
            );
          });

        await writeTextFile(filePath, JSON.stringify(cleanedData, null, 2));
      }
    } catch (error) {}

    setIsExporting(false);
  }, [data, isExporting]);

  return (
    <Modal
      title="Export transaction categories"
      description="Export transaction categories to a file in different formats"
      {...props}
    >
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Export location</legend>
        <input type="file" className="file-input" />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">File format</legend>
        <div className="join">
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="CSV"
            defaultChecked
            onChange={() => setExportFormat("csv")}
            checked={exportFormat === "csv"}
          />
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="JSON"
            onChange={() => setExportFormat("json")}
            checked={exportFormat === "json"}
          />
        </div>
      </fieldset>

      <div className="flex gap-2 justify-end">
        <button className="btn btn-soft" type="reset" onClick={props.onDismiss}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit">
          <span className="loading loading-spinner"></span>
          Export
        </button>
      </div>
    </Modal>
  );
};
