import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { FileUp } from "lucide-react";
import { useState } from "react";
import { useImportCategories } from "../hooks/useImportCategories";

type TransactionCategoryImportModalProps = InjectedModalProps;

export const TransactionCategoryImportModal = (
  props: TransactionCategoryImportModalProps
) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importCategories = useImportCategories();

  return (
    <Modal
      title="Import transaction categories"
      description="Import transaction categories from a file"
      fullScreen
      {...props}
    >
      <div className="flex flex-col gap-4 flex-1">
        {!selectedFile && (
          <div
            className="flex-1 bg-base-300 rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer"
            onClick={importCategories}
          >
            <FileUp className="w-10 h-10" />
            <p>Drop a file here or click to upload</p>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            className="btn btn-soft"
            type="reset"
            onClick={props.onDismiss}
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {}}
            disabled={isImporting || !selectedFile}
          >
            {isImporting && (
              <span className="loading loading-spinner loading-xs" />
            )}
            Import
          </button>
        </div>
      </div>
    </Modal>
  );
};
