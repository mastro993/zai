import { AcceptedFileExtension, exportToFile } from "@/lib/file-processor";
import { useCallback, useState } from "react";
import { useTransactionCategories } from "../api/useTransactionCategories";

type Props = {
  extension: AcceptedFileExtension;
  onSuccess?: () => void;
  onError?: () => void;
};

export const useExportCategories = ({
  extension,
  onError = () => {},
  onSuccess = () => {},
}: Props) => {
  const [isExporting, setIsExporting] = useState(false);
  const categories = useTransactionCategories();

  const exportData = useCallback(async () => {
    if (!categories.data || isExporting) {
      return;
    }

    setIsExporting(true);

    const result = await exportToFile({
      data: categories.data,
      fileName: "zai_transaction_categories",
      extension,
    });

    if (result.isErr()) {
      onError();
      setIsExporting(false);
      return;
    }

    onSuccess();
    setIsExporting(false);
  }, [isExporting, extension, categories]);

  return { exportData, isExporting };
};
