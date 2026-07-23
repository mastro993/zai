import { Link } from "@tanstack/react-router";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { RecurringBulkAction, RecurringBulkPreflight } from "../types/recurring-bulk";

const ACTION_COPY: Record<
  RecurringBulkAction,
  { title: string; irreversible?: boolean; extra?: string }
> = {
  pause: {
    title: "Pause selected recurring transactions?",
    extra: "Due occurrences catch up first. Occurrences due while paused are skipped permanently.",
  },
  resume: {
    title: "Resume selected recurring transactions?",
    extra: "Occurrences skipped while paused are not backfilled.",
  },
  stop: {
    title: "Stop selected recurring transactions?",
    irreversible: true,
    extra: "Stop is irreversible. Due occurrences catch up before stopping.",
  },
  delete: {
    title: "Delete selected recurring transactions?",
    irreversible: true,
    extra:
      "Delete is irreversible. Sources and links disappear; generated transactions remain. Due occurrences catch up first.",
  },
  retryNow: {
    title: "Retry selected generation failures?",
    extra: "Repair-required sources stay unchanged and open focused repair.",
  },
};

export function RecurringBulkReviewDialog({
  open,
  action,
  preflight,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  action: RecurringBulkAction | null;
  preflight: RecurringBulkPreflight | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!action || !preflight) {
    return null;
  }

  const copy = ACTION_COPY[action];
  const summary = [
    `${preflight.selected} selected · ${preflight.eligible} affected · ${preflight.unchanged} unchanged.`,
    `Lifecycle: ${preflight.lifecycle.active} active, ${preflight.lifecycle.paused} paused, ${preflight.lifecycle.stopped} stopped, ${preflight.lifecycle.completed} completed, ${preflight.lifecycle.needsAttention} needing attention.`,
    preflight.dueCatchUp > 0 ? `${preflight.dueCatchUp} due occurrences to catch up.` : null,
    preflight.waiting > 0 ? `${preflight.waiting} waiting due occurrences.` : null,
    preflight.repairNeeded > 0 ? `${preflight.repairNeeded} repair needed.` : null,
    preflight.unchangedItems.length > 0
      ? `Unchanged: ${preflight.unchangedItems
          .map((item) => item.reason.replaceAll("_", " "))
          .join(", ")}.`
      : null,
    copy.extra,
    copy.irreversible ? "This action cannot be undone." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={
        <div className="space-y-3 text-left">
          <p>{summary}</p>
          {preflight.unchangedItems.length > 0 ? (
            <section aria-label="Unchanged selected sources">
              <h3 className="text-sm font-medium">Unchanged sources</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {preflight.unchangedItems.map((item) => (
                  <li key={item.recurringTransactionId}>
                    {item.recurringTransactionId} — {item.reason.replaceAll("_", " ")}
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
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
      isActionPending={isPending}
    >
      <Button
        variant={copy.irreversible ? "destructive" : "default"}
        size="sm"
        disabled={isPending || preflight.eligible === 0}
        aria-busy={isPending}
        onClick={onConfirm}
      >
        {isPending ? "Working..." : copy.irreversible ? actionLabel(action) : "Confirm"}
      </Button>
    </ConfirmationDialog>
  );
}

function actionLabel(action: RecurringBulkAction): string {
  switch (action) {
    case "stop":
      return "Stop";
    case "delete":
      return "Delete";
    default:
      return "Confirm";
  }
}
