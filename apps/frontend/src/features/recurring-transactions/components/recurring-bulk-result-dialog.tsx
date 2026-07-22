import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { RecurringBulkExecuteResult } from "../types/recurring-bulk";

export function RecurringBulkResultDialog({
  open,
  result,
  refreshFailed,
  onOpenChange,
  onRetryRefresh,
}: {
  open: boolean;
  result: RecurringBulkExecuteResult | null;
  refreshFailed: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryRefresh: () => void;
}) {
  if (!result) {
    return null;
  }

  const description = [
    `${result.succeeded} succeeded · ${result.unchanged} unchanged · ${result.failed} failed.`,
    ...result.results
      .filter((item) => item.outcome !== "succeeded")
      .map((item) => {
        const next =
          item.nextAction === "repair"
            ? "Next: Repair"
            : item.nextAction === "retry"
              ? "Next: Retry now"
              : null;
        return `${item.recurringTransactionId}: ${item.outcome}${item.reason ? ` (${item.reason})` : ""}${next ? ` · ${next}` : ""}`;
      }),
    refreshFailed
      ? "Mutations already committed. Feed refresh failed; retry refresh without repeating successful work."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk action results"
      description={description}
    >
      {refreshFailed ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetryRefresh}>
          Retry refresh
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      )}
    </ConfirmationDialog>
  );
}
