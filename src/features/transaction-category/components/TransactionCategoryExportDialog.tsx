import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { exportToFile } from "@/lib/file-processor";
import { Button } from "@heroui/react";
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

export function TransactionCategoryExportDialog(
  dialogProps: React.ComponentProps<typeof Dialog>,
) {
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
      dialogProps.onOpenChange?.(false);
      setIsExporting(false);
      return;
    }

    toast.success("Transaction categories exported successfully");
    dialogProps.onOpenChange?.(false);
    setIsExporting(false);
  }, [isExporting, exportFormat, categories]);

  return (
    <Dialog {...dialogProps}>
      <DialogContent onCloseAutoFocus={() => setExportFormat("json")}>
        <DialogHeader>
          <DialogTitle>Export transaction categories</DialogTitle>
          <DialogDescription>
            Export your transaction categories to a file
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-4">
          <legend className="text-foreground text-sm leading-none font-medium">
            Export format
          </legend>
          <RadioGroup
            className="flex flex-wrap gap-2"
            defaultValue={exportFormatOptions[0].value}
            onValueChange={(value) => setExportFormat(value as "json" | "csv")}
          >
            {exportFormatOptions.map((item) => (
              <div
                key={`${id}-${item.value}`}
                className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    id={`${id}-${item.value}`}
                    value={item.value}
                    className="after:absolute after:inset-0"
                    checked={exportFormat === item.value}
                  />
                  <Label htmlFor={`${id}-${item.value}`}>{item.label}</Label>
                </div>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" color="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" onClick={exportData}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
