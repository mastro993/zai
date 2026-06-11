import { exportToFile } from "@/lib/file-processor";
import { Button, Label, Modal, Radio, RadioGroup } from "@heroui/react";
import { Result } from "@praha/byethrow";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { useTransactionCategories } from "../queries/useTransactionCategories";

const exportFormatOptions = [
  {
    label: "JSON",
    value: "json",
  },
  {
    label: "CSV",
    value: "csv",
  },
];

type ExportDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransactionCategoryExportDialog({ isOpen, onOpenChange }: ExportDialogProps) {
  const id = useId();

  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  const categories = useTransactionCategories();

  const exportData = useCallback(async () => {
    if (!categories.data || isExporting) {
      return;
    }

    setIsExporting(true);

    const result = await exportToFile({
      data: categories.data,
      fileName: "zai_transaction_categories",
      extension: exportFormat,
    });

    if (Result.isFailure(result)) {
      toast.error("Failed to export transaction categories");
      onOpenChange(false);
      setIsExporting(false);
      return;
    }

    toast.success("Transaction categories exported successfully");
    onOpenChange(false);
    setIsExporting(false);
  }, [isExporting, exportFormat, categories, onOpenChange]);

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) setExportFormat("json");
        onOpenChange(open);
      }}
    >
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Export transaction categories</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <RadioGroup
              name={`${id}-export-format`}
              value={exportFormat}
              onChange={(value) => setExportFormat(value as "json" | "csv")}
            >
              <Label>Export format</Label>
              {exportFormatOptions.map((item) => (
                <Radio key={item.value} value={item.value}>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Radio.Content>
                    <Label>{item.label}</Label>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onPress={exportData} isDisabled={isExporting}>
              Export
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
