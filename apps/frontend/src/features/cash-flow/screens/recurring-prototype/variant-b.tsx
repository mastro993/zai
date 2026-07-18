import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScreenBase } from "@/components/screen-base";

import {
  ADOPTABLE_TRANSACTIONS,
  ORPHAN_TRANSACTIONS,
  PROTOTYPE_RECURRING,
  type RecurringPrototype,
} from "./data";
import {
  CountModeLabel,
  LifecycleBadge,
  StateDump,
  amountLabel,
  formatCount,
  progressRatio,
} from "./shared";

export const VARIANT_B_META = { key: "B", name: "Occurrence feed" } as const;

export function VariantB() {
  const [expandedId, setExpandedId] = useState<string | null>(PROTOTYPE_RECURRING[0]?.id ?? null);
  const [wizard, setWizard] = useState<"create" | "adopt" | null>(null);
  const [lastAction, setLastAction] = useState("Opened occurrence feed");

  return (
    <ScreenBase
      actions={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setWizard("adopt");
              setLastAction("Adopt wizard open");
            }}
          >
            Make recurring
          </Button>
          <Button
            type="button"
            onClick={() => {
              setWizard("create");
              setLastAction("Create wizard open");
            }}
          >
            New series
          </Button>
        </>
      }
    >
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Recurring</h1>
          <p className="text-sm text-muted-foreground">
            PROTOTYPE B — card feed. Expand in place. Progress ring owns finite story.
          </p>
        </div>

        {wizard ? (
          <Wizard mode={wizard} onClose={() => setWizard(null)} onAction={setLastAction} />
        ) : null}

        <div className="space-y-3">
          {PROTOTYPE_RECURRING.map((item) => {
            const open = expandedId === item.id;
            return (
              <article key={item.id} className="border border-border">
                <button
                  type="button"
                  className="flex w-full items-stretch gap-4 p-4 text-left"
                  onClick={() => {
                    setExpandedId(open ? null : item.id);
                    setLastAction(open ? `Collapsed ${item.name}` : `Expanded ${item.name}`);
                  }}
                >
                  <ProgressRing item={item} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      <LifecycleBadge lifecycle={item.lifecycle} />
                      <CountModeLabel mode={item.countMode} />
                    </div>
                    <div className="text-sm text-muted-foreground">{item.ruleLabel}</div>
                    <div className="text-sm tabular-nums">
                      {amountLabel(item.amountMinor, item.currency)}
                      {item.nextOccurrenceOn
                        ? ` · next ${item.nextOccurrenceOn}`
                        : " · no upcoming"}
                    </div>
                  </div>
                </button>

                {open ? <ExpandedBody item={item} onAction={setLastAction} /> : null}
              </article>
            );
          })}
        </div>

        <section className="space-y-2 border border-dashed border-border p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            No recurring provenance (tombstone source gone)
          </div>
          {ORPHAN_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex justify-between text-sm">
              <span>
                {tx.label}
                <span className="block text-xs text-muted-foreground">{tx.note}</span>
              </span>
              <span className="tabular-nums">{amountLabel(tx.amountMinor)}</span>
            </div>
          ))}
        </section>

        <StateDump selectedId={expandedId} filter="feed" lastAction={lastAction} />
      </div>
    </ScreenBase>
  );
}

function ProgressRing({ item }: { item: RecurringPrototype }) {
  const ratio = progressRatio(item);
  const pct = ratio === null ? 0 : Math.round(ratio * 100);
  const dash = ratio === null ? 0 : pct;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeDasharray={`${dash} 100`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
        {ratio === null ? "∞" : `${item.fulfilled}/${item.total}`}
      </div>
    </div>
  );
}

function ExpandedBody({
  item,
  onAction,
}: {
  item: RecurringPrototype;
  onAction: (action: string) => void;
}) {
  return (
    <div className="space-y-4 border-t border-border px-4 py-4">
      <div className="text-sm text-muted-foreground">{formatCount(item)}</div>

      <div className="flex flex-wrap gap-2">
        {item.lifecycle === "active" ? (
          <>
            <Button size="sm" variant="outline" type="button" onClick={() => onAction("Pause")}>
              Pause
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => onAction("Stop")}>
              Stop
            </Button>
          </>
        ) : null}
        {item.lifecycle === "paused" ? (
          <Button size="sm" type="button" onClick={() => onAction("Resume")}>
            Resume
          </Button>
        ) : null}
        <Button size="sm" variant="destructive" type="button" onClick={() => onAction("Tombstone")}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => onAction("Edit schedule")}>
          Edit schedule
        </Button>
      </div>

      <section className="space-y-2">
        <div className="text-sm font-medium">Occurrence timeline</div>
        <ol className="relative space-y-3 border-l border-border pl-4">
          {item.linkedTransactions.map((tx) => (
            <li key={tx.id} className="space-y-1 text-sm">
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => onAction(`tx→recurring link via ${tx.id}`)}
              >
                {tx.occurredOn} · {tx.direction}
              </button>
              <div className="text-muted-foreground">
                {tx.label} · {amountLabel(tx.amountMinor)}
              </div>
            </li>
          ))}
          {item.nextOccurrenceOn ? (
            <li className="text-sm text-muted-foreground">
              {item.nextOccurrenceOn} · projected (budget only)
            </li>
          ) : null}
        </ol>
      </section>

      <section className="space-y-1">
        <div className="text-sm font-medium">Budget impact strip</div>
        <div className="flex flex-wrap gap-2">
          {item.budgetImpact.map((row) => (
            <span
              key={`${row.periodLabel}-${row.kind}`}
              className="border border-border px-2 py-1 text-xs"
            >
              {row.periodLabel} {row.kind}: {amountLabel(row.amountMinor)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Wizard({
  mode,
  onClose,
  onAction,
}: {
  mode: "create" | "adopt";
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="space-y-3 border border-foreground p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {mode === "create" ? "Create wizard (3 steps stub)" : "Adopt wizard"}
        </div>
        <Button size="xs" variant="ghost" type="button" onClick={onClose}>
          Close
        </Button>
      </div>
      {mode === "create" ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Name + template amount</li>
          <li>Rule + zone + first occurrence</li>
          <li>Finite / indefinite confirm</li>
        </ol>
      ) : (
        <ul className="space-y-2">
          {ADOPTABLE_TRANSACTIONS.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between text-sm">
              <span>
                {tx.label}
                <span className="block text-xs text-muted-foreground">
                  Catch-up preview: 2 occurrences will generate
                </span>
              </span>
              <Button
                size="xs"
                type="button"
                onClick={() => {
                  onAction(`Adopted ${tx.label}`);
                  onClose();
                }}
              >
                Continue
              </Button>
            </li>
          ))}
        </ul>
      )}
      {mode === "create" ? (
        <Button
          size="sm"
          type="button"
          onClick={() => {
            onAction("Create wizard finished");
            onClose();
          }}
        >
          Finish stub
        </Button>
      ) : null}
    </div>
  );
}
