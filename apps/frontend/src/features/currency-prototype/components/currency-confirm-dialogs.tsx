import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function CurrencyConfirmDialogs({
  defaultCurrency,
  pendingDefault,
  pendingDisable,
  pendingManualRate,
  onCancel,
  onConfirmDefault,
  onConfirmDisable,
  onConfirmManualRate,
}: {
  defaultCurrency: string;
  pendingDefault: string | null;
  pendingDisable: string | null;
  pendingManualRate: string | null;
  onCancel: () => void;
  onConfirmDefault: () => void;
  onConfirmDisable: () => void;
  onConfirmManualRate: () => void;
}) {
  return (
    <>
      <ConfirmationDialog
        open={pendingDefault !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}
        title={
          pendingDefault ? `Use ${pendingDefault} as default currency?` : "Change default currency?"
        }
        description={`Budgets, projections, statistics, and charts will re-express in ${pendingDefault ?? "the new default"}. Original amounts and transaction currencies stay. ${defaultCurrency} remains active until the new results are ready.`}
      >
        <Button size="sm" onClick={onConfirmDefault}>
          Change default
        </Button>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pendingDisable !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}
        title={pendingDisable ? `Disable ${pendingDisable}?` : "Disable currency?"}
        description="It cannot be selected for new transactions or as the default currency. Existing history stays. Recurring transactions keep using it."
      >
        <Button size="sm" variant="destructive" onClick={onConfirmDisable}>
          Disable
        </Button>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pendingManualRate !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}
        title="Replace the current exchange rate?"
        description={`This stores a manual exchange rate of ${pendingManualRate ?? ""}. The previous supplied or manual origin is replaced and stays visible as manual.`}
      >
        <Button size="sm" onClick={onConfirmManualRate}>
          Use manual rate
        </Button>
      </ConfirmationDialog>
    </>
  );
}
