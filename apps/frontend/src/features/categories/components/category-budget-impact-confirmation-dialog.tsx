import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { BudgetImpact } from "@/commands/errors";

function CategoryBudgetImpactConfirmationDialog({
  open,
  budgets,
  isConfirming,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  budgets: Array<BudgetImpact>;
  isConfirming: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Budget results will change"
      description="This category change will recalculate affected budget history and rollover results."
      isActionPending={isConfirming}
    >
      <div className="col-span-full border bg-muted/40 p-3 text-sm">
        <p className="mb-2 font-medium">Affected budgets</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {budgets.map((budget) => (
            <li key={budget.id}>{budget.name}</li>
          ))}
        </ul>
      </div>
      <Button variant="destructive" size="sm" disabled={isConfirming} onClick={onConfirm}>
        {isConfirming ? "Recalculating..." : "Confirm and recalculate"}
      </Button>
    </ConfirmationDialog>
  );
}

export { CategoryBudgetImpactConfirmationDialog };
