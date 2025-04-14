import { useCallback, useState } from "react";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { AcceptedFileExtension, exportToFile } from "@/lib/file-processor";

type Props = {
  format: AcceptedFileExtension;
  onSuccess?: () => void;
  onError?: () => void;
};

export const useExportCategories = ({
  format,
  onError = () => {},
  onSuccess = () => {},
}: Props) => {
  const { data } = useTransactionCategories();
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async () => {
    if (!data || isExporting) {
      return;
    }

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

    const result = await exportToFile({
      data: filteredData,
      fileName: "zai_transaction_categories",
      extension: format,
    });

    if (result.isErr()) {
      onError();
      setIsExporting(false);
      return;
    }

    onSuccess();
    setIsExporting(false);
  }, [data, isExporting, format]);

  return { exportData, isExporting };
};
