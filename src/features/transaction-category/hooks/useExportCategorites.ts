import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { TransactionCategory } from "../schema";

type Props = {
  data?: Array<TransactionCategory>;
  onSuccess?: () => void;
  onError?: () => void;
};

export const useExportCategories = ({ data, onError, onSuccess }: Props) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async () => {
    if (!data || isExporting) {
      return;
    }

    try {
      const formattedDate = dayjs().format("YYYY-MM-DDT-HH-mm-ss");
      const defaultPath = `zai_transaction_categories_${formattedDate}.json`;

      const filePath = await save({
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }],
        canCreateDirectories: true,
      });

      if (filePath) {
        const cleanedData = data
          .map((category) => {
            const { id, name, color, description, parent_id } = category;
            return { id, name, color, description, parent_id };
          })
          .map((category) => {
            return Object.fromEntries(
              Object.entries(category).filter(([_, value]) => value !== null)
            );
          });

        await writeTextFile(filePath, JSON.stringify(cleanedData, null, 2));
        onSuccess?.();
      }
    } catch (error) {
      onError?.();
    }

    setIsExporting(false);
  }, [data, isExporting]);

  return exportData;
};
