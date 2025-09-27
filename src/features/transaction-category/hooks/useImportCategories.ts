import { importFromFile } from "@/lib/file-processor";
import { Result } from "neverthrow";
import { useCallback, useState } from "react";
import { importTransactionCategories } from "../commands";
import {
  NewTransactionCategories,
  TransactionCategoriesSchema,
} from "../types";

export const useImportCategories = (onSuccess?: () => void) => {
  const [rawCategories, setRawCategories] = useState<NewTransactionCategories>(
    []
  );
  const [isImporting, setIsImporting] = useState(false);

  const importCategories = useCallback(async () => {
    setIsImporting(true);
    await importTransactionCategories(rawCategories);
    setIsImporting(false);
    onSuccess?.();
  }, [rawCategories]);

  const selectFile = useCallback(
    () =>
      importFromFile()
        .andThen(
          Result.fromThrowable((data) =>
            TransactionCategoriesSchema.parse(data)
          )
        )
        .map((data) => {
          return data.map((category) => {
            return {
              ...category,
              parent: category.parent_id
                ? data.find((c) => c.id === category.parent_id)
                : undefined,
            };
          });
        })
        .map(setRawCategories),
    []
  );

  return {
    selectFile,
    rawCategories,
    importCategories,
    isImporting,
  };
};
