import { Result } from "@praha/byethrow";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  deleteRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  stopRecurringTransaction,
} from "../commands/recurring-transactions";
import { RecurringLifecycleConfirmDialog } from "./recurring-lifecycle-confirm-dialog";
import { recurringLifecycleLabel } from "../lib/recurring";
import type {
  RecurringLifecycleOutcome,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";

type ConfirmKind = "pause" | "resume" | "stop" | "delete" | null;

const lifecycleOutcomeMessage = (outcome: RecurringLifecycleOutcome): string | undefined => {
  if (outcome.outcome !== "unchanged") {
    return undefined;
  }
  if (outcome.reason === "generation_blocked") {
    return "Repair the generation failure before changing lifecycle.";
  }
  if (outcome.reason === "invalid_transition") {
    return "That lifecycle change is not allowed from the current state.";
  }
  return "No lifecycle change applied.";
};

const confirmCopyFor = (
  kind: Exclude<ConfirmKind, null>,
): {
  title: string;
  description: string;
  actionLabel: string;
  pendingLabel: string;
} => {
  switch (kind) {
    case "pause":
      return {
        title: "Pause this recurring transaction?",
        description:
          "Due work through now catches up first. Later due occurrences stay skipped until you resume, without consuming finite count.",
        actionLabel: "Pause",
        pendingLabel: "Pausing…",
      };
    case "resume":
      return {
        title: "Resume this recurring transaction?",
        description:
          "Occurrences skipped while paused are not backfilled. The next due slot advances past the pause window.",
        actionLabel: "Resume",
        pendingLabel: "Resuming…",
      };
    case "stop":
      return {
        title: "Stop this recurring transaction?",
        description:
          "Stop is irreversible. Due work through now catches up first. The source stays visible and renameable as history.",
        actionLabel: "Stop",
        pendingLabel: "Stopping…",
      };
    case "delete":
      return {
        title: "Delete this recurring transaction?",
        description:
          "This hides the source from every user-facing view. Occurrences, revisions, failures, alerts, and generated transactions remain retained and cannot be restored.",
        actionLabel: "Delete",
        pendingLabel: "Deleting…",
      };
  }
};

export function RecurringLifecycleActions({
  document,
  onDocumentChange,
  onLifecycleError,
}: {
  document: RecurringTransactionDocument;
  onDocumentChange: (document: RecurringTransactionDocument) => void;
  onLifecycleError: (message: string | undefined) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [lifecyclePending, setLifecyclePending] = useState(false);
  const { recurringTransaction, occurrenceSummary } = document;
  const lifecycle = recurringTransaction.lifecycle;
  const needsAttention = occurrenceSummary.needsAttention;
  const canPause = lifecycle === "active" && !needsAttention;
  const canResume = lifecycle === "paused" && !needsAttention;
  const canStop = (lifecycle === "active" || lifecycle === "paused") && !needsAttention;
  const canDelete =
    !needsAttention &&
    (lifecycle === "active" ||
      lifecycle === "paused" ||
      lifecycle === "stopped" ||
      lifecycle === "completed");

  const runLifecycle = async (kind: Exclude<ConfirmKind, null>) => {
    setLifecyclePending(true);
    onLifecycleError(undefined);
    const id = recurringTransaction.id;
    const revision = recurringTransaction.revision;
    const result =
      kind === "pause"
        ? await pauseRecurringTransaction(id, revision)
        : kind === "resume"
          ? await resumeRecurringTransaction(id, revision)
          : kind === "stop"
            ? await stopRecurringTransaction(id, revision)
            : await deleteRecurringTransaction(id, revision);
    setLifecyclePending(false);
    setConfirmKind(null);
    if (Result.isFailure(result)) {
      onLifecycleError(
        result.error.code === "revisionConflict"
          ? "Recurring transaction changed elsewhere. Reload it before changing lifecycle."
          : result.error.message,
      );
      return;
    }
    const message = lifecycleOutcomeMessage(result.value);
    if (message) {
      onLifecycleError(message);
      onDocumentChange(result.value.document);
      return;
    }
    if (kind === "delete") {
      router.clearCache({ filter: (match) => match.routeId === "/cash-flow/recurring/" });
      await navigate({ to: "/cash-flow/recurring" });
      return;
    }
    onDocumentChange(result.value.document);
  };

  const confirmCopy = confirmKind ? confirmCopyFor(confirmKind) : null;

  return (
    <>
      {canPause ? (
        <Button
          variant="outline"
          disabled={lifecyclePending}
          aria-busy={lifecyclePending}
          onClick={() => setConfirmKind("pause")}
        >
          Pause
        </Button>
      ) : null}
      {canResume ? (
        <Button
          variant="outline"
          disabled={lifecyclePending}
          aria-busy={lifecyclePending}
          onClick={() => setConfirmKind("resume")}
        >
          Resume
        </Button>
      ) : null}
      {canStop ? (
        <Button
          variant="outline"
          disabled={lifecyclePending}
          aria-busy={lifecyclePending}
          onClick={() => setConfirmKind("stop")}
        >
          Stop
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="destructive"
          disabled={lifecyclePending}
          aria-busy={lifecyclePending}
          onClick={() => setConfirmKind("delete")}
        >
          Delete
        </Button>
      ) : null}
      {confirmCopy && confirmKind ? (
        <RecurringLifecycleConfirmDialog
          open={confirmKind !== null}
          title={confirmCopy.title}
          description={confirmCopy.description}
          actionLabel={confirmCopy.actionLabel}
          pendingLabel={confirmCopy.pendingLabel}
          isPending={lifecyclePending}
          destructive={confirmKind === "delete" || confirmKind === "stop"}
          onOpenChange={(open) => {
            if (!open && !lifecyclePending) {
              setConfirmKind(null);
            }
          }}
          onConfirm={() => void runLifecycle(confirmKind)}
        />
      ) : null}
      <span className="sr-only" role="status">
        {recurringLifecycleLabel[lifecycle]}
      </span>
    </>
  );
}
