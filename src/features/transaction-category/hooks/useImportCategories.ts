import { importFromFile } from "@/lib/file-processor";
import { Result } from "neverthrow";
import { useCallback, useState } from "react";
import { importTransactionCategories } from "../commands";
import {
  NewTransactionCategories,
  TransactionCategoriesSchema,
} from "../types";

export const useImportCategories = (onSuccess?: () => void) => {
  const [rawCategories, setRawCategories] =
    useState<NewTransactionCategories>();
  const [isImporting, setIsImporting] = useState(false);

  const importCategories = useCallback(async () => {
    if (!rawCategories) {
      return;
    }
    setIsImporting(true);
    await importTransactionCategories(rawCategories);
    setIsImporting(false);
    onSuccess?.();
  }, [rawCategories]);

  const selectFile = useCallback(
    () =>
      importFromFile()
        .andThen(
          Result.fromThrowable((data) => {
            return TransactionCategoriesSchema.parse(data.value);
          })
        )
        .map((data) => {
          return data.map((category) => {
            return {
              ...category,
              parent: category.parentId
                ? data.find((c) => c.id === category.parentId)
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
