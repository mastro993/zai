import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asWireString } from "@/lib/wire";

import { useCurrencyConfirms } from "../hooks/use-currency-confirms";
import {
  addableCatalog,
  convertToDefault,
  findCurrency,
  formatMoney,
  selectableDefaultCurrencies,
  selectableTransactionCurrencies,
} from "../lib/mock-state";
import type { CurrencyPrototypeVariantProps } from "../types";
import { CurrencyConfirmDialogs } from "./currency-confirm-dialogs";

export function VariantC({ scene, state, actions }: CurrencyPrototypeVariantProps) {
  const confirms = useCurrencyConfirms(actions);
  const [setupCode, setSetupCode] = useState(state.localeCurrency);
  const defaultCurrency = findCurrency(state, state.defaultCurrency);
  const stale = state.currencies.filter((item) => item.refreshStatus === "stale");
  const adding = state.currencies.filter(
    (item) => item.status === "adding" || item.status === "failed",
  );
  const catalogItems = addableCatalog(state).map((item) => ({
    value: item.code,
    label: `${item.code} ${item.name}`,
  }));
  const transactionItems = selectableTransactionCurrencies(state).map((item) => ({
    value: item.code,
    label: item.code,
  }));
  const converted = convertToDefault(
    state.transaction.amount,
    state.transaction.currency,
    state.defaultCurrency,
  );
  const pendingConverted = convertToDefault(
    state.pendingTransaction.originalAmount,
    state.pendingTransaction.currency,
    state.defaultCurrency,
  );

  return (
    <div className="space-y-4">
      {scene === "setup" ? (
        <div className="flex min-h-[24rem] flex-col justify-end gap-6">
          <p className="text-sm text-muted-foreground">
            This device looks like {state.localeCurrency}.
          </p>
          <p className="font-heading text-6xl font-semibold tracking-tight sm:text-7xl">
            {selectableDefaultCurrencies(state).find((item) => item.code === setupCode)?.name ??
              setupCode}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectableDefaultCurrencies(state).map((item) => (
              <Button
                key={item.code}
                type="button"
                variant={setupCode === item.code ? "default" : "outline"}
                onClick={() => setSetupCode(item.code)}
              >
                {item.code}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => actions.completeSetup(setupCode)}>
              Use {setupCode}
            </Button>
          </div>
        </div>
      ) : null}

      {scene === "settings" ? (
        <div className="space-y-5">
          <section className="border-b border-border pb-5">
            <p className="text-sm text-muted-foreground">Default currency</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-heading text-5xl font-semibold tracking-tight">
                {defaultCurrency?.name ?? state.defaultCurrency}
              </h2>
              <Select
                items={selectableDefaultCurrencies(state)
                  .filter((item) => item.code !== state.defaultCurrency)
                  .map((item) => ({ value: item.code, label: item.code }))}
                value={null}
                onValueChange={(value) => {
                  const code = asWireString(value);
                  if (code !== undefined) {
                    confirms.askDefault(code);
                  }
                }}
              >
                <SelectTrigger aria-label="Change default currency">
                  <SelectValue placeholder="Change default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {selectableDefaultCurrencies(state)
                      .filter((item) => item.code !== state.defaultCurrency)
                      .map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.code} {item.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {stale.length > 0
                ? `${stale.map((item) => item.code).join(", ")} last refresh is stale.`
                : "Live projection rates are fresh."}
            </p>
          </section>

          {adding.map((item) => (
            <Alert key={item.code} variant={item.status === "failed" ? "destructive" : "default"}>
              <AlertTitle>
                {item.status === "failed" ? `${item.code} coverage failed` : `Adding ${item.code}`}
              </AlertTitle>
              <AlertDescription>
                {item.status === "failed"
                  ? `Missing ${item.missingPeriods.join(", ")}. Partial activation is not allowed.`
                  : "This currency cannot be selected until complete historical coverage is validated."}
                <span className="mt-2 flex gap-2">
                  {item.status === "adding" ? (
                    <>
                      <Button size="xs" onClick={() => actions.finishAdd(item.code)}>
                        Coverage ready
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => actions.failAdd(item.code)}
                      >
                        Fail
                      </Button>
                    </>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => actions.reenable(item.code)}>
                      Retry
                    </Button>
                  )}
                </span>
              </AlertDescription>
            </Alert>
          ))}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Enabled currencies</h3>
              <Select
                items={catalogItems}
                value={confirms.addCode}
                onValueChange={(value) => {
                  const code = asWireString(value);
                  if (code !== undefined) {
                    confirms.setAddCode(code);
                    actions.startAdd(code);
                  }
                }}
              >
                <SelectTrigger size="sm" aria-label="Add currency">
                  <SelectValue placeholder="Add currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {catalogItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {state.currencies.map((item) => (
                <DropdownMenu key={item.code}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant={item.status === "enabled" ? "secondary" : "outline"}
                      />
                    }
                  >
                    {item.code}
                    {item.code === state.defaultCurrency ? (
                      <Badge variant="outline">Default</Badge>
                    ) : (
                      <Badge variant="outline">{item.status}</Badge>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {item.status === "enabled" && item.code !== state.defaultCurrency ? (
                      <>
                        <DropdownMenuItem onClick={() => confirms.askDefault(item.code)}>
                          Set as default
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => confirms.askDisable(item.code)}>
                          Disable
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {item.status === "disabled" ? (
                      <DropdownMenuItem onClick={() => actions.reenable(item.code)}>
                        Re-enable
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {scene === "form" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
          <Field>
            <FieldLabel htmlFor="workspace-amount">Original amount</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="workspace-amount"
                className="h-12 text-xl tabular-nums"
                value={state.transaction.amount}
                onChange={(event) => actions.setTransactionAmount(event.target.value)}
              />
              <Select
                items={transactionItems}
                value={state.transaction.currency}
                onValueChange={(value) => {
                  const code = asWireString(value);
                  if (code !== undefined) {
                    actions.setTransactionCurrency(code);
                  }
                }}
              >
                <SelectTrigger className="h-12 w-28" aria-label="Transaction currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {transactionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <aside className="bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">In {state.defaultCurrency}</p>
            <p className="mt-1 font-heading text-3xl tabular-nums">
              {converted ? formatMoney(converted, state.defaultCurrency) : "Incomplete"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {state.transaction.rateOrigin} rate {state.transaction.rate} on{" "}
              {state.transaction.rateDate}
            </p>
            <Field className="mt-3">
              <FieldLabel htmlFor="workspace-rate">Manual rate</FieldLabel>
              <Input
                id="workspace-rate"
                value={confirms.manualDraft || state.transaction.rate}
                onChange={(event) => confirms.setManualDraft(event.target.value)}
              />
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={() =>
                  confirms.askManualRate(confirms.manualDraft || state.transaction.rate)
                }
              >
                Replace rate
              </Button>
            </Field>
          </aside>
        </div>
      ) : null}

      {scene === "detail" ? (
        <article className="space-y-5">
          {state.pendingTransaction.status === "pending" ? (
            <Alert variant="destructive">
              <AlertTitle>Exchange-rate pending</AlertTitle>
              <AlertDescription>
                Dinner, Tokyo has no transaction exchange rate. Affected cross-currency results stay
                incomplete until retry or a manual rate.
                <span className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={actions.retryPending}>
                    Retry
                  </Button>
                  <Input
                    className="w-28"
                    aria-label="Manual recovery rate"
                    value={confirms.pendingManualDraft}
                    onChange={(event) => confirms.setPendingManualDraft(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!confirms.pendingManualDraft}
                    onClick={() => actions.resolvePendingWithManual(confirms.pendingManualDraft)}
                  >
                    Enter rate
                  </Button>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-muted-foreground">{state.pendingTransaction.description}</p>
          <p className="font-heading text-5xl font-semibold tabular-nums tracking-tight">
            {state.pendingTransaction.status === "resolved" && pendingConverted
              ? formatMoney(pendingConverted, state.defaultCurrency)
              : "Incomplete"}
          </p>
          <p className="text-sm">
            {formatMoney(
              state.pendingTransaction.originalAmount,
              state.pendingTransaction.currency,
            )}{" "}
            · {state.pendingTransaction.rateOrigin}
            {state.pendingTransaction.rate ? ` · ${state.pendingTransaction.rate}` : ""} ·{" "}
            {state.pendingTransaction.date}
          </p>
        </article>
      ) : null}

      {scene === "import" ? (
        <div className="space-y-3">
          {state.importNeeds
            .filter((need) => need.action !== "already-enabled")
            .map((need) => (
              <Alert key={need.code}>
                <AlertTitle>
                  {need.action === "add"
                    ? `Will add ${need.code}`
                    : need.action === "re-enable"
                      ? `Will re-enable ${need.code}`
                      : `Will backfill ${need.code}`}
                </AlertTitle>
                <AlertDescription>{need.coverage}</AlertDescription>
              </Alert>
            ))}
          <p className="text-sm text-muted-foreground">
            Confirming prepares every listed currency and imports every ready row together.
          </p>
          <Button type="button" disabled={state.importConfirmed} onClick={actions.confirmImport}>
            Prepare and import
          </Button>
        </div>
      ) : null}

      <CurrencyConfirmDialogs
        defaultCurrency={state.defaultCurrency}
        pendingDefault={confirms.pendingDefault}
        pendingDisable={confirms.pendingDisable}
        pendingManualRate={confirms.pendingManualRate}
        onCancel={confirms.cancel}
        onConfirmDefault={confirms.confirmDefault}
        onConfirmDisable={confirms.confirmDisable}
        onConfirmManualRate={confirms.confirmManualRate}
      />
    </div>
  );
}
