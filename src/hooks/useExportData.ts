import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { useCallback, useState } from "react";

type Props = {
  data?: any;
  filePrefix?: string;
  onSuccess?: () => void;
  onError?: () => void;
};

export const useExportToFile = ({
  data,
  filePrefix = "spiccy_export",
  onError,
  onSuccess,
}: Props) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async () => {
    if (!data) {
      return;
    }

    setIsExporting(true);

    try {
      const formattedDate = dayjs().format("YYYY-MM-DDT-HH-mm-ss");
      const defaultPath = `${filePrefix}_${formattedDate}.json`;

      const filePath = await save({
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }],
        canCreateDirectories: true,
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        onSuccess?.();
      }
    } catch (error) {
      onError?.();
    }

    setIsExporting(false);
  }, [data]);

  return {
    isExporting,
    exportData,
  };
};
