import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  formatFiniteProgress,
  formatLocalDateTime,
  formatScheduleRule,
  recurringLifecycleLabel,
} from "../lib/recurring";
import type { RecurringTransactionDocument } from "../types/recurring-transaction";

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

export function RecurringDocumentScreen({ document }: { document: RecurringTransactionDocument }) {
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

        <Section title="Identity" state="ready" emptyMessage="">
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
          <p className="text-sm">
            {links.occurrences.items.length} linked occurrence
            {links.occurrences.items.length === 1 ? "" : "s"}
          </p>
        </Section>

        <Section title="Failures" state={failures.state} emptyMessage="No generation failures.">
          <p className="text-sm">
            {failures.unresolved
              ? "There is an unresolved generation failure."
              : `${failures.history.items.length} failure history entries.`}
          </p>
        </Section>

        <Section
          title="Budget impact"
          state={budgetImpact.state}
          emptyMessage="No budget impact."
          failureMessage={budgetImpact.message}
        />
      </div>
    </ScreenBase>
  );
}
