import { importFromFile } from "@/lib/file-processor";
import { db } from "@/lib/database";
import { useCallback, useState } from "react";
import { z } from "zod";
import { TransactionCategoryColors } from "../schema";
import { Result } from "neverthrow";

const _RawCategorySchema = z.object({
  id: z.coerce.number(),
  name: z.string().nonempty(),
  color: z.enum(TransactionCategoryColors).nullable(),
  parent_id: z.coerce.number().nullable(),
  description: z.string().nullable(),
});

const RawCategorySchema = _RawCategorySchema.extend({
  parent: _RawCategorySchema.optional(),
});

const RawCategoryImportSchema = z.array(RawCategorySchema);

type RawCategoryImport = z.infer<typeof RawCategoryImportSchema>;

export const useImportCategories = (onSuccess?: () => void) => {
  const [rawCategories, setRawCategories] = useState<RawCategoryImport>();
  const [isImporting, setIsImporting] = useState(false);

  const importCategories = useCallback(async () => {
    setIsImporting(true);
    const parentCategories =
      rawCategories?.filter((category) => !category.parent_id) ?? [];

    for (const parent of parentCategories) {
      await db.transaction().execute(async (trx) => {
        const { id: parentId } = await trx
          .insertInto("transaction_category")
          .values({
            name: parent.name,
            color: parent.color,
            description: parent.description,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        const children =
          rawCategories
            ?.filter((c) => c.parent_id === parent.id)
            ?.map((child) => ({
              name: child.name,
              color: child.color,
              description: child.description,
              parent_id: parentId,
            })) ?? [];

        return await trx
          .insertInto("transaction_category")
          .values(children)
          .returningAll()
          .executeTakeFirst();
      });
    }
    setIsImporting(false);
    onSuccess?.();
  }, [rawCategories]);

  const selectFile = useCallback(
    () =>
      importFromFile()
        .andThen(
          Result.fromThrowable((data) => RawCategoryImportSchema.parse(data))
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
        .map((data) => {
          return data.sort((a, b) => {
            return a.id - b.id;
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
