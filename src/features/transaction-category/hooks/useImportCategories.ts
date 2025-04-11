import { useCallback, useState } from "react";
import { z } from "zod";
import { TransactionCategoryColors } from "../schema";
import { importFromFile } from "@/features/file-processor";
import { Effect, pipe } from "effect";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/database";

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

export const useImportCategories = (onSuccess: () => void) => {
  const [isImporting, setIsImporting] = useState(false);
  const [rawCategories, setRawCategories] = useState<RawCategoryImport>();
  const queryClient = useQueryClient();

  const selectFile = useCallback(
    () =>
      Effect.runPromise(
        pipe(
          importFromFile(),
          Effect.map(RawCategoryImportSchema.parse),
          Effect.map((validatedData) => {
            return validatedData.map((category) => {
              return {
                ...category,
                parent: category.parent_id
                  ? validatedData.find((c) => c.id === category.parent_id)
                  : undefined,
              };
            });
          }),
          Effect.map((categories) => {
            return categories.sort((a, b) => {
              return a.id - b.id;
            });
          }),
          Effect.map(setRawCategories)
        )
      ),
    []
  );

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

    queryClient.invalidateQueries({
      queryKey: ["transactionCategories"],
    });

    setIsImporting(false);

    onSuccess();
  }, [onSuccess, queryClient]);

  return {
    selectFile,
    importCategories,
    isImporting,
    rawCategories,
  };
};
