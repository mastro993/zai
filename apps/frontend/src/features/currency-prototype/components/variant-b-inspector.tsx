import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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

export function VariantB({ scene, state, actions }: CurrencyPrototypeVariantProps) {
  const confirms = useCurrencyConfirms(actions);
  const [selectedCode, setSelectedCode] = useState(state.defaultCurrency);
  const [setupCode, setSetupCode] = useState(state.localeCurrency);
  const selected = findCurrency(state, selectedCode) ?? state.currencies[0];
  const catalogItems = addableCatalog(state).map((item) => ({
    value: item.code,
    label: `${item.code} ${item.name}`,
  }));
  const transactionItems = selectableTransactionCurrencies(state).map((item) => ({
    value: item.code,
    label: `${item.code} ${item.name}`,
  }));
  const converted = convertToDefault(
    state.transaction.amount,
    state.transaction.currency,
    state.defaultCurrency,
  );

  return (
    <div className="space-y-4">
      {scene === "setup" ? (
        <div className="mx-auto max-w-lg space-y-4">
          <header className="space-y-1">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Choose your default currency
            </h2>
            <p className="text-sm text-muted-foreground">
              {state.localeCurrency} is preselected from this device locale. You must confirm it.
            </p>
          </header>
          <ul className="divide-y divide-border border border-border">
            {selectableDefaultCurrencies(state).map((item) => {
              const checked = setupCode === item.code;
              return (
                <li key={item.code}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                    <input
                      type="radio"
                      name="inspector-setup"
                      checked={checked}
                      onChange={() => setSetupCode(item.code)}
                    />
                    <span className="flex-1">
                      <span className="block font-medium">
                        {item.name} ({item.code})
                      </span>
                      {item.code === state.localeCurrency ? (
                        <span className="text-xs text-muted-foreground">
                          Suggested from this device
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Button type="button" className="w-full" onClick={() => actions.completeSetup(setupCode)}>
            Continue
          </Button>
        </div>
      ) : null}

      {scene === "settings" ? (
        <div className="grid min-h-[28rem] gap-0 border border-border lg:grid-cols-[16rem_1fr]">
          <div className="border-b border-border lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <p className="text-sm font-medium">Currencies</p>
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
                  <SelectValue placeholder="Add" />
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
            <ul>
              {state.currencies.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm",
                      selectedCode === item.code ? "bg-muted" : "hover:bg-muted/50",
                    )}
                    onClick={() => setSelectedCode(item.code)}
                  >
                    <span>
                      <span className="block font-medium">{item.code}</span>
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.code === state.defaultCurrency ? "Default" : item.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selected ? (
            <div className="flex flex-col gap-4 p-4">
              <header>
                <h2 className="font-heading text-2xl font-semibold">
                  {selected.name} ({selected.code})
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selected.status === "adding"
                    ? "Adding currency. Not selectable until coverage is complete."
                    : selected.status === "failed"
                      ? "Complete coverage could not be obtained."
                      : selected.status === "disabled"
                        ? "Disabled. History and recurring use stay."
                        : selected.code === state.defaultCurrency
                          ? "Default currency for all converted values."
                          : "Enabled currency."}
                </p>
              </header>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Historical coverage</dt>
                  <dd>
                    {selected.missingPeriods.length > 0
                      ? `Missing ${selected.missingPeriods.join(", ")}`
                      : selected.coverageFrom
                        ? `${selected.coverageFrom} through ${selected.coverageTo}`
                        : "Not yet retrieved"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last refresh</dt>
                  <dd>
                    {selected.lastRefresh ?? "None"} ({selected.refreshStatus})
                  </dd>
                </div>
              </dl>
              <div className="mt-auto flex flex-wrap gap-2">
                {selected.status === "adding" ? (
                  <>
                    <Button size="sm" onClick={() => actions.finishAdd(selected.code)}>
                      Coverage ready
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => actions.failAdd(selected.code)}
                    >
                      Fail coverage
                    </Button>
                  </>
                ) : null}
                {selected.status === "enabled" && selected.code !== state.defaultCurrency ? (
                  <>
                    <Button size="sm" onClick={() => confirms.askDefault(selected.code)}>
                      Set as default
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirms.askDisable(selected.code)}
                    >
                      Disable
                    </Button>
                  </>
                ) : null}
                {selected.status === "disabled" || selected.status === "failed" ? (
                  <Button size="sm" onClick={() => actions.reenable(selected.code)}>
                    Re-enable
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {scene === "form" ? (
        <FieldGroup className="max-w-lg border border-border p-4">
          <Field>
            <FieldLabel htmlFor="inspector-amount">Original amount</FieldLabel>
            <Input
              id="inspector-amount"
              value={state.transaction.amount}
              onChange={(event) => actions.setTransactionAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="inspector-currency">Transaction currency</FieldLabel>
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
              <SelectTrigger id="inspector-currency" className="w-full">
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
          </Field>
          <Field>
            <FieldLabel htmlFor="inspector-rate">Transaction exchange rate</FieldLabel>
            <FieldDescription>
              Date-specific {state.transaction.rateOrigin} rate for {state.transaction.date}.
              Converted value{" "}
              {converted ? formatMoney(converted, state.defaultCurrency) : "unavailable"}.
            </FieldDescription>
            <Input
              id="inspector-rate"
              value={confirms.manualDraft || state.transaction.rate}
              onChange={(event) => confirms.setManualDraft(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => confirms.askManualRate(confirms.manualDraft || state.transaction.rate)}
            >
              Save as manual rate
            </Button>
          </Field>
        </FieldGroup>
      ) : null}

      {scene === "detail" ? (
        <div className="grid gap-6 border border-border p-4 lg:grid-cols-2">
          <section>
            <h2 className="font-heading text-2xl font-semibold">
              {state.pendingTransaction.description}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.pendingTransaction.date}</p>
            <p className="mt-6 text-3xl tabular-nums">
              {formatMoney(
                state.pendingTransaction.originalAmount,
                state.pendingTransaction.currency,
              )}
            </p>
          </section>
          <section className="bg-muted/40 p-4">
            <h3 className="text-sm font-medium">Exchange-rate details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Transaction currency</dt>
                <dd>{state.pendingTransaction.currency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rate</dt>
                <dd>{state.pendingTransaction.rate ?? "Missing"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Origin</dt>
                <dd>{state.pendingTransaction.rateOrigin}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Default value</dt>
                <dd>
                  {state.pendingTransaction.status === "resolved"
                    ? formatMoney(
                        convertToDefault(
                          state.pendingTransaction.originalAmount,
                          state.pendingTransaction.currency,
                          state.defaultCurrency,
                        ) ?? "unavailable",
                        state.defaultCurrency,
                      )
                    : "Incomplete"}
                </dd>
              </div>
            </dl>
            {state.pendingTransaction.status === "pending" ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm">
                  Temporary lookup failure. Affected results stay incomplete.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={actions.retryPending}>
                    Retry lookup
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
                    Manual rate
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {scene === "import" ? (
        <div className="space-y-4">
          <header>
            <h2 className="font-heading text-xl font-semibold">
              Currencies this import will prepare
            </h2>
            <p className="text-sm text-muted-foreground">
              Review every add, re-enable, and backfill before the atomic import.
            </p>
          </header>
          <ol className="space-y-2">
            {state.importNeeds.map((need, index) => (
              <li key={need.code} className="flex items-start gap-3 border border-border p-3">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                <div className="flex-1">
                  <p className="font-medium">
                    {need.name} ({need.code})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {need.action} · {need.coverage}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" disabled={state.importConfirmed} onClick={actions.confirmImport}>
            Confirm currencies and import
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
