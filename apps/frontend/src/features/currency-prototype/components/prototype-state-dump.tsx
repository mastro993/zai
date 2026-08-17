import { Button } from "@/components/ui/button";

import type { CurrencyPrototypeActions } from "../hooks/use-currency-prototype-state";
import type { PrototypeState } from "../lib/mock-state";

export function PrototypeStateDump({
  state,
  onReset,
}: {
  state: PrototypeState;
  onReset: CurrencyPrototypeActions["reset"];
}) {
  const enabled = state.currencies
    .filter((item) => item.status === "enabled")
    .map((item) => item.code);
  const adding = state.currencies
    .filter((item) => item.status === "adding")
    .map((item) => item.code);
  const disabled = state.currencies
    .filter((item) => item.status === "disabled")
    .map((item) => item.code);

  return (
    <aside
      className="border border-dashed border-border bg-muted/30 p-3 font-mono text-[0.7rem] leading-relaxed text-muted-foreground"
      aria-label="Prototype state"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-sans text-xs font-medium text-foreground">Prototype state</p>
        <Button type="button" size="xs" variant="outline" onClick={onReset}>
          Reset fixtures
        </Button>
      </div>
      <p>{state.lastAction}</p>
      <p className="mt-2">
        default={state.defaultCurrency} lastUsed={state.lastUsedTransactionCurrency ?? "none"}{" "}
        setup=
        {state.setupComplete ? "done" : "open"} import=
        {state.importConfirmed ? "committed" : "preview"}
      </p>
      <p>enabled={enabled.join(", ") || "none"}</p>
      <p>adding={adding.join(", ") || "none"}</p>
      <p>disabled={disabled.join(", ") || "none"}</p>
      <p>
        form={state.transaction.amount} {state.transaction.currency} rate={state.transaction.rate}{" "}
        origin=
        {state.transaction.rateOrigin}
      </p>
      <p>
        pending={state.pendingTransaction.status} {state.pendingTransaction.originalAmount}{" "}
        {state.pendingTransaction.currency}
      </p>
    </aside>
  );
}
