import { AcceptedFileExtension, exportToFile } from "@/lib/file-processor";
import { useCallback, useState } from "react";
import { getTransactionCategories } from "../commands";

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

  const exportData = useCallback(async () => {
    const data = await getTransactionCategories();

    if (!data || isExporting) {
      return;
    }

    setIsExporting(true);

    const result = await exportToFile({
      data,
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
  }, [isExporting, extension]);

  return { exportData, isExporting };
};
