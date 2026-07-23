import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  getRecurringTransactionOccurrences,
  updateRecurringTransaction,
} from "../commands/recurring-transactions";
import { RecurringFailureBanner } from "../components/recurring-failure-banner";
import { RecurringFormDrawer } from "../components/recurring-form-drawer";
import { RecurringLifecycleActions } from "../components/recurring-lifecycle-actions";
import { RecurringBudgetImpact } from "../components/recurring-budget-impact";
import {
  formatFiniteProgress,
  formatLocalDateTime,
  formatScheduleRule,
  recurringLifecycleLabel,
} from "../lib/recurring";
import type {
  RecurringFormValues,
  RecurringOccurrence,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";

function Section({
  title,
  state,
  children,
  emptyMessage,
  failureMessage,
}: {
  title: string;
  state: "ready" | "empty" | "unavailable";
  children?: React.ReactNode;
  emptyMessage: string;
  failureMessage?: string;
}) {
  return (
    <section className="space-y-2 border-b border-border py-6 last:border-b-0" aria-label={title}>
      <h2 className="text-lg font-medium">{title}</h2>
      {state === "empty" ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null}
      {state === "unavailable" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {failureMessage ?? "Unavailable"}
        </p>
      ) : null}
      {state === "ready" ? children : null}
    </section>
  );
}

const canEditConfiguration = (document: RecurringTransactionDocument): boolean => {
  const lifecycle = document.recurringTransaction.lifecycle;
  return (
    (lifecycle === "active" || lifecycle === "paused") && !document.occurrenceSummary.needsAttention
  );
};

const canEditDescription = (document: RecurringTransactionDocument): boolean => {
  const lifecycle = document.recurringTransaction.lifecycle;
  return (
    lifecycle === "active" ||
    lifecycle === "paused" ||
    lifecycle === "stopped" ||
    lifecycle === "completed"
  );
};

function OccurrenceLinks({
  recurringTransactionId,
  initialItems,
  initialNextCursor,
}: {
  recurringTransactionId: string;
  initialItems: Array<RecurringOccurrence>;
  initialNextCursor?: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string>();

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    const result = await getRecurringTransactionOccurrences(recurringTransactionId, 50, nextCursor);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      setIsLoadingMore(false);
      return;
    }
    setItems((current) => [...current, ...result.value.items]);
    setNextCursor(result.value.nextCursor);
    setIsLoadingMore(false);
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((occurrence) => (
          <li key={`${occurrence.scheduleRevisionId}:${occurrence.ordinal}`}>
            <Link
              to="/cash-flow/transactions"
              className="flex flex-wrap items-center justify-between gap-2 text-sm underline-offset-4 hover:underline"
              aria-label={`Open transactions list for occurrence ${occurrence.fulfillmentPosition}`}
            >
              <span>
                #{occurrence.fulfillmentPosition} · {formatLocalDateTime(occurrence.scheduledLocal)}{" "}
                · {occurrence.transactionId}
              </span>
              <Badge variant="outline">
                {occurrence.fulfillmentKind === "adopted" ? "Adopted" : "Generated"}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {nextCursor ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadMore()}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? "Loading…" : "Load more linked transactions"}
        </Button>
      ) : null}
    </div>
  );
}

export function RecurringDocumentScreen({
  document: initialDocument,
  categories,
}: {
  document: RecurringTransactionDocument;
  categories: Array<TransactionCategory>;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string>();
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    recurringTransaction,
    schedule,
    template,
    occurrenceSummary,
    links,
    failures,
    budgetImpact,
  } = document;
  const progressLabel = formatFiniteProgress(
    occurrenceSummary.fulfilledCount,
    occurrenceSummary.totalOccurrences,
  );
  const configurationEditable = canEditConfiguration(document);
  const descriptionEditable = canEditDescription(document);
  const editable = configurationEditable || descriptionEditable;
  const lifecycle = recurringTransaction.lifecycle;

  const submitEdit = async (values: RecurringFormValues) => {
    const result = await updateRecurringTransaction(document, values);
    if (Result.isSuccess(result)) {
      setDocument(result.value.document);
    }
    return result;
  };

  return (
    <ScreenBase
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button ref={editButtonRef} variant="outline" onClick={() => setIsEditOpen(true)}>
              {configurationEditable ? "Edit recurring transaction" : "Edit description"}
            </Button>
          ) : null}
          <RecurringLifecycleActions
            document={document}
            onDocumentChange={setDocument}
            onLifecycleError={setLifecycleError}
          />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/cash-flow/recurring" />}
          >
            Back to feed
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{template.description}</h1>
            <Badge>{recurringLifecycleLabel[recurringTransaction.lifecycle]}</Badge>
            {occurrenceSummary.needsAttention ? (
              <Badge variant="destructive">Needs attention</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">Revision {recurringTransaction.revision}</p>
          {lifecycleError ? (
            <p
              role="alert"
              className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {lifecycleError}
            </p>
          ) : null}
        </div>

        {occurrenceSummary.needsAttention ? (
          <RecurringFailureBanner
            document={document}
            categories={categories}
            onDocumentChange={setDocument}
          />
        ) : null}

        <Section title="Identity" state="ready" emptyMessage="">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd>{template.description}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lifecycle</dt>
              <dd>
                <span role="status">{recurringLifecycleLabel[recurringTransaction.lifecycle]}</span>
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Schedule" state="ready" emptyMessage="">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Rule</dt>
              <dd>{formatScheduleRule(schedule.rule)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">First occurrence</dt>
              <dd>{formatLocalDateTime(schedule.firstScheduledLocal)}</dd>
            </div>
          </dl>
          {!configurationEditable && occurrenceSummary.needsAttention ? (
            <p role="status" className="text-sm text-muted-foreground">
              Schedule, template, count, pause, stop, and delete are unavailable while generation
              needs attention.
            </p>
          ) : null}
        </Section>

        <Section title="Template" state="ready" emptyMessage="">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd>{formatCurrencyFromMinor(template.amount, "EUR")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="capitalize">{template.transactionType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd>{template.description || "—"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Count" state="ready" emptyMessage="">
          <p className="text-sm">{progressLabel ?? "Indefinite"}</p>
        </Section>

        <Section title="Lifecycle" state="ready" emptyMessage="">
          <p className="text-sm">
            {recurringLifecycleLabel[recurringTransaction.lifecycle]} since{" "}
            {formatLocalDateTime(recurringTransaction.lifecycleChangedAt)}
          </p>
          {lifecycle === "stopped" || lifecycle === "completed" ? (
            <p role="status" className="text-sm text-muted-foreground">
              This source is immutable except for description editing.
            </p>
          ) : null}
        </Section>

        <Section title="Occurrence summary" state="ready" emptyMessage="">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Progress</dt>
              <dd>{progressLabel ?? "Indefinite"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next scheduled</dt>
              <dd>{formatLocalDateTime(occurrenceSummary.nextScheduledLocal)}</dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Links"
          state={links.state}
          emptyMessage="No fulfilled transactions linked yet."
        >
          <OccurrenceLinks
            recurringTransactionId={recurringTransaction.id}
            initialItems={links.occurrences.items}
            initialNextCursor={links.occurrences.nextCursor}
          />
        </Section>

        <Section
          title="Failures"
          state={failures.state}
          emptyMessage="No generation failures."
          failureMessage={undefined}
        >
          {failures.unresolved ? (
            <p role="status" className="text-sm text-muted-foreground">
              Open failure details appear in the Needs attention banner above.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No open generation failure.</p>
          )}
        </Section>

        <Section
          title="Budget impact"
          state={budgetImpact.state}
          emptyMessage="No active budget includes this source in the forecast window."
          failureMessage={budgetImpact.message}
        >
          <RecurringBudgetImpact impact={budgetImpact} />
        </Section>
      </div>

      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen} swipeDirection="right">
        {isEditOpen ? (
          <RecurringFormDrawer
            mode={{ type: "edit", document }}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            onSubmit={submitEdit}
            categories={categories}
            configurationEditable={configurationEditable}
            descriptionEditable={descriptionEditable}
            returnFocusRef={editButtonRef}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
