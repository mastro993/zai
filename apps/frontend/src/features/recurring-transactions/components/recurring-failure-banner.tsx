import { Result } from "@praha/byethrow";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  getRecurringGenerationFailureDiagnostics,
  retryRecurringGenerationFailure,
} from "../commands/recurring-transactions";
import { formatLocalDateTime } from "../lib/recurring";
import { recurringFailureCauseLabel } from "./recurring-failure-labels";
import type {
  RecurringRepairField,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";
import { RecurringRepairDrawer } from "./recurring-repair-drawer";

const fieldLabel = (repairFieldKey: RecurringRepairField | null | undefined): string => {
  if (!repairFieldKey) {
    return "Not repairable";
  }
  switch (repairFieldKey) {
    case "transactionCategoryId":
      return "Category";
    case "amount":
      return "Amount";
  }
};

const permittedActionLabel = (
  nextAction: RecurringTransactionDocument["failures"]["nextAction"],
): string => {
  switch (nextAction) {
    case "repair":
      return "Repair";
    case "retry":
      return "Retry now";
    case "copyDiagnostics":
      return "Copy diagnostics";
    default:
      return "Review";
  }
};

export function RecurringFailureBanner({
  document,
  categories,
  onDocumentChange,
}: {
  document: RecurringTransactionDocument;
  categories: Array<TransactionCategory>;
  onDocumentChange: (document: RecurringTransactionDocument) => void;
}) {
  const unresolved = document.failures.unresolved;
  const repairButtonRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (!unresolved) {
    return null;
  }

  const nextAction = document.failures.nextAction ?? "copyDiagnostics";
  const canRepair = nextAction === "repair" && !unresolved.repairedAt;
  const canRetry = nextAction === "retry" || Boolean(unresolved.repairedAt);

  const onRetry = async () => {
    setPending(true);
    const result = await retryRecurringGenerationFailure(
      document.recurringTransaction.id,
      document.recurringTransaction.revision,
    );
    setPending(false);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    if (result.value.outcome === "unchanged") {
      toast.message(
        result.value.reason === "repair_required"
          ? "Repair the failing field before retrying."
          : "No retry applied.",
      );
      onDocumentChange(result.value.document);
      return;
    }
    onDocumentChange(result.value.document);
  };

  const onCopyDiagnostics = async () => {
    setPending(true);
    const result = await getRecurringGenerationFailureDiagnostics(document.recurringTransaction.id);
    setPending(false);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    const payload = JSON.stringify(result.value, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      toast.success("Diagnostics copied");
      return;
    }
    toast.message(payload);
  };

  const onRepairOpenChange = (open: boolean) => {
    setIsRepairOpen(open);
    if (!open) {
      queueMicrotask(() => repairButtonRef.current?.focus());
    }
  };

  return (
    <section
      className="space-y-3 border border-destructive/30 bg-destructive/5 p-4"
      aria-label="Generation needs attention"
      aria-labelledby={headingId}
      role="status"
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-base font-medium">
          Needs attention
        </h2>
        <p className="text-sm">{recurringFailureCauseLabel(unresolved.causeCategory)}</p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Failed occurrence</dt>
          <dd>{formatLocalDateTime(unresolved.failedScheduledLocal)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Failing field</dt>
          <dd>{fieldLabel(unresolved.repairFieldKey)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Waiting later due</dt>
          <dd>{document.failures.waitingCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Next action</dt>
          <dd>{permittedActionLabel(nextAction)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        {canRepair ? (
          <Button ref={repairButtonRef} disabled={pending} onClick={() => setIsRepairOpen(true)}>
            Repair
          </Button>
        ) : null}
        {canRetry ? (
          <Button
            variant="outline"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void onRetry()}
          >
            Retry now
          </Button>
        ) : null}
        {!canRepair ? (
          <Button
            variant="outline"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void onCopyDiagnostics()}
          >
            Copy diagnostics
          </Button>
        ) : null}
      </div>

      <Drawer open={isRepairOpen} onOpenChange={onRepairOpenChange} swipeDirection="right">
        {isRepairOpen && unresolved.repairFieldKey ? (
          <RecurringRepairDrawer
            document={document}
            repairFieldKey={unresolved.repairFieldKey}
            categories={categories}
            open={isRepairOpen}
            onOpenChange={onRepairOpenChange}
            onDocumentChange={onDocumentChange}
            returnFocusRef={repairButtonRef}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
