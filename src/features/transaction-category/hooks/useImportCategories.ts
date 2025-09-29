import { importFromFile } from "@/lib/file-processor";
import { Result } from "neverthrow";
import { useCallback, useEffect, useState } from "react";
import {
  NewTransactionCategories,
  TransactionCategoriesSchema,
} from "../types";
import { useImportTransactionCategories } from "../api/useImportTransactionCategories";

export const useImportCategories = (onSuccess?: () => void) => {
  const [rawCategories, setRawCategories] =
    useState<NewTransactionCategories>();

  const {
    mutate: importCategoriesMutation,
    isPending,
    isSuccess,
  } = useImportTransactionCategories();

  useEffect(() => {
    if (isSuccess) {
      setRawCategories(undefined);
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  const importCategories = useCallback(() => {
    if (rawCategories) {
      importCategoriesMutation(rawCategories);
    }
  }, [rawCategories, importCategoriesMutation]);

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
    isImporting: isPending,
    clear: () => setRawCategories(undefined),
  };
};
