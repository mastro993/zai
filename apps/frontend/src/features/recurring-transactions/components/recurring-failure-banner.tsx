import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  getRecurringGenerationFailureDiagnostics,
  getRecurringTransactionFailureHistory,
  retryRecurringGenerationFailure,
} from "../commands/recurring-transactions";
import { formatLocalDateTime } from "../lib/recurring";
import type {
  RecurringGenerationFailure,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";
import { RecurringRepairDrawer } from "./recurring-repair-drawer";

const causeLabel = (causeCategory: string): string => {
  switch (causeCategory) {
    case "template":
      return "Template problem";
    case "reference":
      return "Missing reference";
    case "validation":
      return "Validation problem";
    default:
      return "Generation problem";
  }
};

const fieldLabel = (repairFieldKey: string | null | undefined): string => {
  switch (repairFieldKey) {
    case "transaction_category_id":
      return "Category";
    case "amount":
      return "Amount";
    case "template_revision_id":
      return "Template revision";
    default:
      return "Unknown field";
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
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(document.failures.history.items);
  const [historyCursor, setHistoryCursor] = useState(document.failures.history.nextCursor);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [pending, setPending] = useState(false);

  if (!unresolved) {
    return null;
  }

  const nextAction = document.failures.nextAction ?? "retry";
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

  const loadMoreHistory = async () => {
    if (!historyCursor || isLoadingHistory) {
      return;
    }
    setIsLoadingHistory(true);
    const result = await getRecurringTransactionFailureHistory(
      document.recurringTransaction.id,
      20,
      historyCursor,
    );
    setIsLoadingHistory(false);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    setHistoryItems((current) => [...current, ...result.value.items]);
    setHistoryCursor(result.value.nextCursor);
  };

  return (
    <section
      className="space-y-3 border border-destructive/30 bg-destructive/5 p-4"
      aria-label="Generation needs attention"
      role="status"
    >
      <div className="space-y-1">
        <h2 className="text-base font-medium">Needs attention</h2>
        <p className="text-sm">{causeLabel(unresolved.causeCategory)}</p>
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
        <Button
          variant="ghost"
          aria-expanded={isHistoryOpen}
          onClick={() => setIsHistoryOpen((open) => !open)}
        >
          {isHistoryOpen ? "Hide history" : "Show history"}
        </Button>
      </div>
      {isHistoryOpen ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">Resolved failure history</h3>
          {historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved failures yet.</p>
          ) : (
            <ul className="space-y-2">
              {historyItems.map((item) => (
                <FailureHistoryItem key={historyItemKey(item)} item={item} />
              ))}
            </ul>
          )}
          {historyCursor ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingHistory}
              onClick={() => void loadMoreHistory()}
            >
              {isLoadingHistory ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Drawer open={isRepairOpen} onOpenChange={setIsRepairOpen} swipeDirection="right">
        {isRepairOpen && unresolved.repairFieldKey ? (
          <RecurringRepairDrawer
            document={document}
            repairFieldKey={unresolved.repairFieldKey}
            categories={categories}
            open={isRepairOpen}
            onOpenChange={setIsRepairOpen}
            onDocumentChange={onDocumentChange}
            returnFocusRef={repairButtonRef}
          />
        ) : null}
      </Drawer>
    </section>
  );
}

function historyItemKey(item: RecurringGenerationFailure): string {
  return `${item.scheduleRevisionId}:${item.ordinal}:${item.firstFailedAt}`;
}

function FailureHistoryItem({ item }: { item: RecurringGenerationFailure }) {
  return (
    <li className="text-sm">
      <p>
        {causeLabel(item.causeCategory)} · {formatLocalDateTime(item.failedScheduledLocal)}
      </p>
      <p className="text-muted-foreground">
        Failed {formatLocalDateTime(item.firstFailedAt)}
        {item.resolvedAt ? ` · Resolved ${formatLocalDateTime(item.resolvedAt)}` : null}
      </p>
    </li>
  );
}
