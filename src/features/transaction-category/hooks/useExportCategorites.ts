import { useCallback, useState } from "react";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { AcceptedFileExtension, exportToFile } from "@/features/file-processor";
import { Effect, pipe } from "effect";

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

    await Effect.runPromise(
      pipe(
        exportToFile({
          data: filteredData,
          fileName: "zai_transaction_categories",
          extension: format,
        }),
        Effect.map(onSuccess),
        Effect.catchAll(() => {
          onError();
          setIsExporting(false);
          return Effect.void;
        })
      )
    );
  }, [data, isExporting, format]);

  return { exportData, isExporting };
};
