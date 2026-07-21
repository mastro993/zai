import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";
import type { TransactionCategory } from "@/features/categories/types/model";

import { getRecurringTransactionOccurrences } from "../commands/recurring-transactions";
import {
  editRecurringCount,
  editRecurringSchedule,
  editRecurringTemplate,
  renameRecurringTransaction,
} from "../commands/recurring-transactions";
import {
  RecurringEditDrawer,
  type RecurringEditSection,
} from "../components/recurring-edit-drawer";
import {
  formatFiniteProgress,
  formatLocalDateTime,
  formatScheduleRule,
  recurringLifecycleLabel,
} from "../lib/recurring";
import type {
  RecurringEditFormValues,
  RecurringMutationOutcome,
  RecurringOccurrence,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";

function Section({
  title,
  state,
  children,
  emptyMessage,
  failureMessage,
  action,
}: {
  title: string;
  state: "ready" | "empty" | "unavailable";
  children?: React.ReactNode;
  emptyMessage: string;
  failureMessage?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-b border-border py-6 last:border-b-0" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {action}
      </div>
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

const canRename = (lifecycle: RecurringTransactionDocument["recurringTransaction"]["lifecycle"]) =>
  lifecycle === "active" ||
  lifecycle === "paused" ||
  lifecycle === "stopped" ||
  lifecycle === "completed";

const canEditConfiguration = (document: RecurringTransactionDocument): boolean => {
  const lifecycle = document.recurringTransaction.lifecycle;
  return (
    (lifecycle === "active" || lifecycle === "paused") && !document.occurrenceSummary.needsAttention
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
  const [editSection, setEditSection] = useState<RecurringEditSection | null>(null);
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

  const applyOutcome = (outcome: RecurringMutationOutcome) => {
    setDocument(outcome.document);
  };

  const submitEdit = async (values: RecurringEditFormValues) => {
    const id = recurringTransaction.id;
    const revision = recurringTransaction.revision;
    const result =
      values.section === "name"
        ? await renameRecurringTransaction(id, revision, values.name)
        : values.section === "schedule"
          ? await editRecurringSchedule(id, revision, values)
          : values.section === "template"
            ? await editRecurringTemplate(id, revision, values)
            : await editRecurringCount(id, revision, values);
    if (Result.isSuccess(result)) {
      applyOutcome(result.value);
    }
    return result;
  };

  return (
    <ScreenBase
      actions={
        <Button variant="outline" nativeButton={false} render={<Link to="/cash-flow/recurring" />}>
          Back to feed
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{recurringTransaction.name}</h1>
            <Badge>{recurringLifecycleLabel[recurringTransaction.lifecycle]}</Badge>
            {occurrenceSummary.needsAttention ? (
              <Badge variant="destructive">Needs attention</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">Revision {recurringTransaction.revision}</p>
        </div>

        <Section
          title="Identity"
          state="ready"
          emptyMessage=""
          action={
            canRename(recurringTransaction.lifecycle) ? (
              <Button variant="outline" size="sm" onClick={() => setEditSection("name")}>
                Rename
              </Button>
            ) : null
          }
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{recurringTransaction.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lifecycle</dt>
              <dd>{recurringLifecycleLabel[recurringTransaction.lifecycle]}</dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Schedule"
          state="ready"
          emptyMessage=""
          action={
            configurationEditable ? (
              <Button variant="outline" size="sm" onClick={() => setEditSection("schedule")}>
                Edit
              </Button>
            ) : null
          }
        >
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
              Schedule edits are unavailable while generation needs attention.
            </p>
          ) : null}
        </Section>

        <Section
          title="Template"
          state="ready"
          emptyMessage=""
          action={
            configurationEditable ? (
              <Button variant="outline" size="sm" onClick={() => setEditSection("template")}>
                Edit
              </Button>
            ) : null
          }
        >
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

        <Section
          title="Count"
          state="ready"
          emptyMessage=""
          action={
            configurationEditable ? (
              <Button variant="outline" size="sm" onClick={() => setEditSection("count")}>
                Edit
              </Button>
            ) : null
          }
        >
          <p className="text-sm">{progressLabel ?? "Indefinite"}</p>
        </Section>

        <Section title="Lifecycle" state="ready" emptyMessage="">
          <p className="text-sm">
            {recurringLifecycleLabel[recurringTransaction.lifecycle]} since{" "}
            {formatLocalDateTime(recurringTransaction.lifecycleChangedAt)}
          </p>
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
            <p role="status" className="text-sm">
              Needs attention: repair required before schedule, template, or count edits.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No open generation failure.</p>
          )}
        </Section>

        <Section
          title="Budget impact"
          state={budgetImpact.state}
          emptyMessage=""
          failureMessage={budgetImpact.message}
        />
      </div>

      <Drawer
        open={editSection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditSection(null);
          }
        }}
      >
        {editSection ? (
          <RecurringEditDrawer
            open={editSection !== null}
            section={editSection}
            document={document}
            categories={categories}
            onOpenChange={(open) => {
              if (!open) {
                setEditSection(null);
              }
            }}
            onSubmit={submitEdit}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
