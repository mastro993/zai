import { Button } from "@/components/ui/button";
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
import { useId, useState } from "react";
import { toast } from "sonner";
import { useExportCategories } from "../hooks/useExportCategorites";

export function TransactionCategoryExportDialog(
  dialogProps: React.ComponentProps<typeof Dialog>
) {
  const id = useId();
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  const { exportData } = useExportCategories({
    format: exportFormat,
    onSuccess: () => {
      toast.success("Transaction categories exported successfully");
      dialogProps.onOpenChange?.(false);
    },
    onError: () => {
      toast.error("Failed to export transaction categories");
    },
  });

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

  return (
    <Dialog {...dialogProps}>
      <DialogContent onCloseAutoFocus={() => setExportFormat("csv")}>
        <DialogHeader>
          <DialogTitle>Export transaction categories</DialogTitle>
          <DialogDescription>
            Export transaction categories to a file in different formats
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
            <Button type="button" variant="secondary">
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
