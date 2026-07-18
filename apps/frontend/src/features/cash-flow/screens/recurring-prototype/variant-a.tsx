import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScreenBase } from "@/components/screen-base";

import {
  ADOPTABLE_TRANSACTIONS,
  ORPHAN_TRANSACTIONS,
  PROTOTYPE_RECURRING,
  type RecurringLifecycle,
  type RecurringPrototype,
} from "./data";
import {
  CountModeLabel,
  LifecycleBadge,
  ProgressBar,
  StateDump,
  amountLabel,
  formatCount,
} from "./shared";

export const VARIANT_A_META = { key: "A", name: "Split inspector" } as const;

type Filter = "all" | RecurringLifecycle;

export function VariantA() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(PROTOTYPE_RECURRING[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"create" | "adopt" | null>(null);
  const [lastAction, setLastAction] = useState("Opened split inspector");

  const items = useMemo(() => {
    return PROTOTYPE_RECURRING.filter((item) => {
      if (filter !== "all" && item.lifecycle !== filter) {
        return false;
      }
      if (!query.trim()) {
        return true;
      }
      return item.name.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [filter, query]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <ScreenBase
      actions={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setPanel("adopt");
              setLastAction("Opened adopt picker");
            }}
          >
            Adopt transaction
          </Button>
          <Button
            type="button"
            onClick={() => {
              setPanel("create");
              setLastAction("Opened create form");
            }}
          >
            New recurring
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recurring</h1>
        <p className="text-sm text-muted-foreground">
          PROTOTYPE A — list + persistent inspector. Tombstones never appear.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name"
              className="max-w-xs"
            />
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[filter]}
              onValueChange={(values) => {
                const next = values.at(-1);
                if (next) {
                  setFilter(next as Filter);
                }
              }}
            >
              {(["all", "active", "paused", "stopped", "completed"] as const).map((value) => (
                <ToggleGroupItem key={value} value={value}>
                  {value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    data-state={selected?.id === item.id ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(item.id);
                      setLastAction(`Selected ${item.name}`);
                    }}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.ruleLabel}</TableCell>
                    <TableCell className="text-xs">{formatCount(item)}</TableCell>
                    <TableCell>
                      <LifecycleBadge lifecycle={item.lifecycle} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amountLabel(item.amountMinor, item.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 border border-border p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transactions with no recurring link
            </div>
            {ORPHAN_TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <div>{tx.label}</div>
                  <div className="text-xs text-muted-foreground">{tx.note}</div>
                </div>
                <div className="tabular-nums">{amountLabel(tx.amountMinor)}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4 border border-border p-4">
          {selected ? <Inspector item={selected} onAction={setLastAction} /> : null}
          {panel === "create" ? (
            <CreateStub
              onClose={() => setPanel(null)}
              onConfirm={() => {
                setLastAction("Stub create confirmed");
                setPanel(null);
              }}
            />
          ) : null}
          {panel === "adopt" ? (
            <AdoptStub
              onClose={() => setPanel(null)}
              onConfirm={(label) => {
                setLastAction(`Stub adopt: ${label}`);
                setPanel(null);
              }}
            />
          ) : null}
        </aside>
      </div>

      <StateDump selectedId={selected?.id ?? null} filter={filter} lastAction={lastAction} />
    </ScreenBase>
  );
}

function Inspector({
  item,
  onAction,
}: {
  item: RecurringPrototype;
  onAction: (action: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{item.name}</h2>
          <LifecycleBadge lifecycle={item.lifecycle} />
          <CountModeLabel mode={item.countMode} />
        </div>
        <p className="text-sm text-muted-foreground">{item.templateDescription}</p>
        <ProgressBar item={item} />
      </div>

      <section className="space-y-1 text-sm">
        <div className="font-medium">Schedule</div>
        <div>{item.ruleLabel}</div>
        <div className="text-muted-foreground">
          Zone {item.zone}
          {item.nextOccurrenceOn ? ` · next ${item.nextOccurrenceOn}` : " · no next occurrence"}
        </div>
        <div className="text-muted-foreground">{item.categoryPath}</div>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium">Lifecycle</div>
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
          <Button
            size="sm"
            variant="destructive"
            type="button"
            onClick={() => onAction("Tombstone (confirm)")}
          >
            Delete
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium">Linked transactions</div>
        <ul className="space-y-2 text-sm">
          {item.linkedTransactions.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between gap-2 border-b border-border pb-2"
            >
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => onAction(`Open tx ${tx.id} ← from recurring`)}
              >
                <div>{tx.label}</div>
                <div className="text-xs text-muted-foreground">
                  {tx.occurredOn} · {tx.direction}
                </div>
              </button>
              <span className="tabular-nums">{amountLabel(tx.amountMinor)}</span>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => onAction(`Open recurring ← from tx ${item.linkedTransactions[0]?.id}`)}
        >
          Follow reverse link from latest tx
        </Button>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium">Budget impact</div>
        <ul className="space-y-1 text-sm">
          {item.budgetImpact.map((row) => (
            <li key={`${row.budgetName}-${row.periodLabel}`} className="flex justify-between gap-2">
              <span>
                {row.budgetName} · {row.periodLabel}{" "}
                <span className="text-xs text-muted-foreground">({row.kind})</span>
              </span>
              <span className="tabular-nums">{amountLabel(row.amountMinor)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CreateStub({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="space-y-2 border border-dashed border-border p-3">
      <div className="text-sm font-medium">Create from scratch (stub)</div>
      <Input placeholder="Display name" defaultValue="New recurring" />
      <Input placeholder="First occurrence" defaultValue="2026-08-01" />
      <div className="flex gap-2">
        <Button size="sm" type="button" onClick={onConfirm}>
          Create
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AdoptStub({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (label: string) => void;
}) {
  return (
    <div className="space-y-2 border border-dashed border-border p-3">
      <div className="text-sm font-medium">Adopt existing transaction</div>
      <p className="text-xs text-muted-foreground">Catch-up count shown before confirm.</p>
      <ul className="space-y-2">
        {ADOPTABLE_TRANSACTIONS.map((tx) => (
          <li key={tx.id} className="flex items-center justify-between gap-2 text-sm">
            <div>
              <div>{tx.label}</div>
              <div className="text-xs text-muted-foreground">{tx.occurredOn} · catch-up 2 due</div>
            </div>
            <Button size="xs" type="button" onClick={() => onConfirm(tx.label)}>
              Adopt
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" type="button" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
