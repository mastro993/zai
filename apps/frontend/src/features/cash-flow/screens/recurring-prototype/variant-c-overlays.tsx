import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ADOPTABLE_TRANSACTIONS, type RecurringPrototype } from "./data";
import { CountModeLabel, LifecycleBadge, ProgressBar, amountLabel } from "./shared";

export function DocumentOverlay({
  item,
  onClose,
  onAction,
}: {
  item: RecurringPrototype;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col border border-foreground bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{item.name}</h2>
              <LifecycleBadge lifecycle={item.lifecycle} />
              <CountModeLabel mode={item.countMode} />
            </div>
            <p className="text-xs text-muted-foreground">Document view · not a card grid</p>
          </div>
          <Button size="sm" variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Identity</h3>
            <p className="text-sm">{item.templateDescription}</p>
            <p className="text-sm text-muted-foreground">{item.categoryPath}</p>
            <p className="text-2xl tabular-nums">{amountLabel(item.amountMinor, item.currency)}</p>
            <ProgressBar item={item} />
          </section>

          <section className="space-y-1 text-sm">
            <h3 className="font-medium">Schedule</h3>
            <p>{item.ruleLabel}</p>
            <p className="text-muted-foreground">IANA zone {item.zone}</p>
            <p className="text-muted-foreground">
              {item.nextOccurrenceOn
                ? `Next occurrence ${item.nextOccurrenceOn}`
                : "Terminal — no next occurrence"}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Lifecycle actions</h3>
            <div className="flex flex-wrap gap-2">
              {item.lifecycle === "active" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => onAction("Pause")}
                  >
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => onAction("Stop")}
                  >
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
                onClick={() => onAction("Tombstone confirm")}
              >
                Delete forever (soft)
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Bidirectional links</h3>
            <ul className="space-y-2 text-sm">
              {item.linkedTransactions.map((tx) => (
                <li key={tx.id} className="border border-border p-2">
                  <div className="flex justify-between gap-2">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => onAction(`Recurring → tx ${tx.id}`)}
                    >
                      {tx.label}
                    </button>
                    <span className="tabular-nums">{amountLabel(tx.amountMinor)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {tx.occurredOn} · {tx.direction}
                    </span>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => onAction(`Tx ${tx.id} → recurring ${item.id}`)}
                    >
                      Open source recurring
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Historical + projected budget impact</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.budgetImpact.map((row) => (
                  <TableRow key={`${row.budgetName}-${row.periodLabel}-${row.kind}`}>
                    <TableCell>{row.budgetName}</TableCell>
                    <TableCell>{row.periodLabel}</TableCell>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amountLabel(row.amountMinor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ComposerDialog({
  mode,
  onClose,
  onAction,
}: {
  mode: "create" | "adopt";
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div className="w-full max-w-md space-y-4 border border-foreground bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">
            {mode === "create" ? "Create recurring" : "Adopt transaction"}
          </h3>
          <Button size="xs" variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
        {mode === "create" ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Step stub: name → schedule/zone → count mode → review.</p>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                onAction("Created from scratch");
                onClose();
              }}
            >
              Confirm create
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {ADOPTABLE_TRANSACTIONS.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <div>{tx.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Occurrence one = {tx.occurredOn} · catch-up 2
                  </div>
                </div>
                <Button
                  size="xs"
                  type="button"
                  onClick={() => {
                    onAction(`Adopted ${tx.label}`);
                    onClose();
                  }}
                >
                  Adopt
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
