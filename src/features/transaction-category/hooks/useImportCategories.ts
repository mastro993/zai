import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useState } from "react";
import { z } from "zod";
import { TransactionCategoryColors } from "../schema";
import Papa from "papaparse";

const TransactionCategoryImportSchema = z.array(
  z.object({
    id: z.coerce.number(),
    name: z.string().nonempty(),
    color: z.enum(TransactionCategoryColors),
    icon: z.string().optional(),
    parent_id: z.coerce.number().optional(),
    description: z.string().optional(),
  })
);

const AcceptedFileExtensions = ["json", "csv"] as const;
type AcceptedFileExtension = (typeof AcceptedFileExtensions)[number];

const parser: Record<AcceptedFileExtension, (data: string) => any> = {
  json: (data: string) => JSON.parse(data),
  csv: (data: string) =>
    Papa.parse(data, { header: true, skipEmptyLines: true }).data,
};

const isValidFileExtension = (
  extension: string | undefined
): extension is AcceptedFileExtension => {
  return AcceptedFileExtensions.includes(extension as AcceptedFileExtension);
};

export const useImportCategories = () => {
  const [_, setIsImporting] = useState(false);

  const importCategories = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "CSV", extensions: ["csv"] },
        ],
      });

      if (filePath) {
        const data = await readTextFile(filePath);
        const fileExtension = filePath.split(".").pop();

        if (!isValidFileExtension(fileExtension)) {
          throw new Error("Invalid file extension");
        }
        const parsedData = parser[fileExtension](data);
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
