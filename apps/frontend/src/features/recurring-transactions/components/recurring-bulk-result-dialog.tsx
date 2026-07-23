import { Link } from "@tanstack/react-router";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { RecurringBulkExecuteResult, RecurringBulkItemResult } from "../types/recurring-bulk";

const reasonLabel = (reason: string | undefined): string => {
  switch (reason) {
    case "invalid_transition":
      return "Not eligible for this action";
    case "generation_blocked":
      return "Needs attention before this action";
    case "repair_required":
      return "Repair required before retry";
    case "no_open_failure":
      return "No open generation failure";
    case "revision_conflict":
      return "Changed by another update";
    case "already_applied":
      return "Already in the target state";
    case "not_found":
      return "No longer available";
    case "operation_failed":
      return "Operation failed";
    case "retry_failed":
      return "Retry did not resolve the failure";
    default:
      return reason ?? "Unchanged";
  }
};

function ResultGroup({
  title,
  items,
  labels,
}: {
  title: string;
  items: Array<RecurringBulkItemResult>;
  labels: Map<string, string>;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="space-y-1" aria-label={title}>
      <h3 className="text-sm font-medium">
        {title} ({items.length})
      </h3>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item) => {
          const label = labels.get(item.recurringTransactionId) ?? item.recurringTransactionId;
          return (
            <li key={`${item.outcome}-${item.recurringTransactionId}`}>
              {label}
              {item.outcome === "succeeded" ? null : ` — ${reasonLabel(item.reason)}`}
              {item.nextAction === "repair" ? (
                <>
                  {" · "}
                  <Link
                    className="underline underline-offset-2"
                    to="/cash-flow/recurring/$recurringTransactionId"
                    params={{ recurringTransactionId: item.recurringTransactionId }}
                  >
                    Open repair
                  </Link>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RecurringBulkResultDialog({
  open,
  result,
  labels,
  refreshFailed,
  onOpenChange,
  onRetryRefresh,
}: {
  open: boolean;
  result: RecurringBulkExecuteResult | null;
  labels: Map<string, string>;
  refreshFailed: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryRefresh: () => void;
}) {
  if (!result) {
    return null;
  }

  const succeeded = result.results.filter((item) => item.outcome === "succeeded");
  const unchanged = result.results.filter((item) => item.outcome === "unchanged");
  const failed = result.results.filter((item) => item.outcome === "failed");

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk action results"
      description={
        <div className="space-y-3 text-left">
          <p>
            {result.succeeded} succeeded · {result.unchanged} unchanged · {result.failed} failed.
            {refreshFailed
              ? " Mutations already committed. Feed refresh failed; retry refresh without repeating successful work."
              : null}
          </p>
          <ResultGroup title="Succeeded" items={succeeded} labels={labels} />
          <ResultGroup title="Unchanged" items={unchanged} labels={labels} />
          <ResultGroup title="Failed" items={failed} labels={labels} />
        </div>
      }
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
