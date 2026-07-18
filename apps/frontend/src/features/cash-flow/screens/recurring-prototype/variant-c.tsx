import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

import { ORPHAN_TRANSACTIONS, PROTOTYPE_RECURRING } from "./data";
import { LifecycleBadge, StateDump, amountLabel, formatCount } from "./shared";
import { ComposerDialog, DocumentOverlay } from "./variant-c-overlays";

export const VARIANT_C_META = { key: "C", name: "Document + impact" } as const;

type Mode = "manage" | "impact";

export function VariantC() {
  const [mode, setMode] = useState<Mode>("manage");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composer, setComposer] = useState<"create" | "adopt" | null>(null);
  const [lastAction, setLastAction] = useState("Opened document + impact");

  const openItem = PROTOTYPE_RECURRING.find((item) => item.id === openId) ?? null;
  const impactRows = useMemo(
    () =>
      PROTOTYPE_RECURRING.flatMap((item) =>
        item.budgetImpact.map((row) => ({
          ...row,
          recurringName: item.name,
          recurringId: item.id,
        })),
      ),
    [],
  );

  return (
    <ScreenBase
      actions={
        mode === "manage" ? (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setComposer("adopt");
                setLastAction("Adopt dialog");
              }}
            >
              Adopt
            </Button>
            <Button
              type="button"
              onClick={() => {
                setComposer("create");
                setLastAction("Create dialog");
              }}
            >
              New
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Recurring</h1>
            <p className="text-sm text-muted-foreground">
              PROTOTYPE C — dense index + full-bleed document. Separate Impact board.
            </p>
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[mode]}
            onValueChange={(values) => {
              const next = values.at(-1);
              if (next === "manage" || next === "impact") {
                setMode(next);
                setLastAction(`Mode ${next}`);
              }
            }}
          >
            <ToggleGroupItem value="manage">Manage</ToggleGroupItem>
            <ToggleGroupItem value="impact">Impact</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {mode === "manage" ? (
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PROTOTYPE_RECURRING.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium underline-offset-2 hover:underline"
                        onClick={() => {
                          setOpenId(item.id);
                          setLastAction(`Opened document ${item.name}`);
                        }}
                      >
                        {item.name}
                      </button>
                    </TableCell>
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
        ) : (
          <ImpactBoard
            rows={impactRows}
            onOpen={(id, name) => {
              setOpenId(id);
              setMode("manage");
              setLastAction(`Impact → ${name}`);
            }}
          />
        )}

        <section className="space-y-2 border border-border p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transaction list excerpt — tombstoned sources omitted
          </div>
          {ORPHAN_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex justify-between text-sm">
              <span>
                {tx.label}
                <span className="ml-2 text-xs text-muted-foreground">no recurring chrome</span>
              </span>
              <span className="tabular-nums">{amountLabel(tx.amountMinor)}</span>
            </div>
          ))}
        </section>

        <StateDump selectedId={openId} filter={mode} lastAction={lastAction} />
      </div>

      {openItem ? (
        <DocumentOverlay item={openItem} onClose={() => setOpenId(null)} onAction={setLastAction} />
      ) : null}

      {composer ? (
        <ComposerDialog
          mode={composer}
          onClose={() => setComposer(null)}
          onAction={setLastAction}
        />
      ) : null}
    </ScreenBase>
  );
}

function ImpactBoard({
  rows,
  onOpen,
}: {
  rows: Array<{
    recurringName: string;
    recurringId: string;
    budgetName: string;
    periodLabel: string;
    kind: "historical" | "projected";
    amountMinor: number;
  }>;
  onOpen: (id: string, name: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <button
          key={`${row.recurringId}-${row.periodLabel}-${row.kind}`}
          type="button"
          className="space-y-2 border border-border p-4 text-left hover:bg-muted/40"
          onClick={() => onOpen(row.recurringId, row.recurringName)}
        >
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>{row.kind}</span>
            <span>{row.periodLabel}</span>
          </div>
          <div className="font-medium">{row.recurringName}</div>
          <div className="text-sm text-muted-foreground">{row.budgetName}</div>
          <div className="text-lg tabular-nums">{amountLabel(row.amountMinor)}</div>
        </button>
      ))}
    </div>
  );
}
