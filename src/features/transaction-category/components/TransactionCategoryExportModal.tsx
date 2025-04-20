import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useExportCategories } from "../hooks/useExportCategorites";

type TransactionCategoryExportModalProps = InjectedModalProps;

export const TransactionCategoryExportModal = (
  props: TransactionCategoryExportModalProps
) => {
  const id = useId();
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv");

  const { exportData, isExporting } = useExportCategories({
    format: exportFormat,
    onSuccess: () => {
      toast.success("Transaction categories exported successfully");
      props.onDismiss?.();
    },
    onError: () => {
      toast.error("Failed to export transaction categories");
    },
  });

  return (
    <Modal
      title="Export transaction categories"
      description="Export transaction categories to a file in different formats"
      {...props}
    >
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm leading-none font-medium">
          Format
        </legend>
        <RadioGroup className="flex flex-wrap gap-2" defaultValue="1">
          {["csv", "json"].map((item) => (
            <div
              key={`${id}-${item}`}
              className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  id={`${id}-${item}`}
                  value={item}
                  className="after:absolute after:inset-0"
                  checked={exportFormat === item}
                />
                <Label htmlFor={`${id}-${item}`}>{item}</Label>
              </div>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={props.onDismiss}
          disabled={isExporting}
        >
          Cancel
        </Button>
        <Button onClick={exportData} disabled={isExporting}>
          {isExporting && <Loader2 className="animate-spin" />}
          Export
        </Button>
      </div>
    </Modal>
  );
};
