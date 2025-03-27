import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useState } from "react";
import { z } from "zod";
import { TransactionCategoryColors } from "../schema";

const TransactionCategoryImportSchema = z.array(
  z.object({
    id: z.coerce.number(),
    name: z.string().nonempty(),
    color: z.enum(TransactionCategoryColors),
    icon: z.string().optional(),
    parent_id: z.number().optional(),
    description: z.string().optional(),
  })
);

export const useImportCategories = () => {
  const [_, setIsImporting] = useState(false);

  const importCategories = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (filePath) {
        const data = await readTextFile(filePath);
        const parsedData = JSON.parse(data);

        const validatedData = TransactionCategoryImportSchema.parse(parsedData);
        const sortedData = validatedData.sort((a, b) => {
          return (a.parent_id ?? 0) - (b.parent_id ?? 0);
        });

        console.log(sortedData);
      }
    } catch (error) {
      console.error(error);
    }

    setIsImporting(false);
  }, []);

  return importCategories;
};
