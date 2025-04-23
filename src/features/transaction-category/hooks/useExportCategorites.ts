import { db } from "@/lib/database";
import { AcceptedFileExtension, exportToFile } from "@/lib/file-processor";
import { useCallback, useState } from "react";
import { children, parent } from "../schema/helpers";

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
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async () => {
    const data = await db
      .selectFrom("transaction_category")
      .selectAll("transaction_category")
      .where("deleted_at", "is", null)
      .select(({ ref }) => [
        children(ref("transaction_category.id")).as("children"),
        parent(ref("transaction_category.parent_id")).as("parent"),
      ])
      .execute();

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

    const result = await exportToFile({
      data: filteredData,
      fileName: "zai_transaction_categories",
      extension: format,
    });

    if (result.isErr()) {
      onError();
      setIsExporting(false);
      return;
    }

    onSuccess();
    setIsExporting(false);
  }, [isExporting, format]);

  return { exportData, isExporting };
};
