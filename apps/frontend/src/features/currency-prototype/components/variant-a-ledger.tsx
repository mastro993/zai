import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asWireString } from "@/lib/wire";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCurrencyConfirms } from "../hooks/use-currency-confirms";
import {
  addableCatalog,
  convertToDefault,
  formatMoney,
  selectableDefaultCurrencies,
  selectableTransactionCurrencies,
} from "../lib/mock-state";
import type { CurrencyPrototypeVariantProps } from "../types";
import { CurrencyConfirmDialogs } from "./currency-confirm-dialogs";

const statusLabel = (status: string) => {
  if (status === "enabled") return "Enabled";
  if (status === "adding") return "Adding";
  if (status === "failed") return "Coverage failed";
  return "Disabled";
};

export function VariantA({ scene, state, actions }: CurrencyPrototypeVariantProps) {
  const confirms = useCurrencyConfirms(actions);
  const [rateOpen, setRateOpen] = useState(false);
  const [setupCode, setSetupCode] = useState(state.localeCurrency);
  const selectable = selectableTransactionCurrencies(state);
  const selectItems = selectable.map((item) => ({
    value: item.code,
    label: item.code,
  }));
  const catalogItems = addableCatalog(state).map((item) => ({
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
        <FieldGroup className="max-w-xl border border-border p-4">
          <Field>
            <FieldLabel htmlFor="ledger-setup-currency">Default currency</FieldLabel>
            <FieldDescription>
              Zai inferred {state.localeCurrency} from this device. Confirm it or pick another
              supported currency before setup finishes.
            </FieldDescription>
            <Select
              items={selectableDefaultCurrencies(state).map((item) => ({
                value: item.code,
                label: `${item.code} ${item.name}`,
              }))}
              value={setupCode}
              onValueChange={(value) => {
                const code = asWireString(value);
                if (code !== undefined) {
                  setSetupCode(code);
                }
              }}
            >
              <SelectTrigger id="ledger-setup-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectableDefaultCurrencies(state).map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button type="button" onClick={() => actions.completeSetup(setupCode)}>
            Confirm default currency
          </Button>
        </FieldGroup>
      ) : null}

      {scene === "settings" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-56">
              <FieldLabel htmlFor="ledger-add">Add currency</FieldLabel>
              <Select
                items={catalogItems}
                value={confirms.addCode}
                onValueChange={(value) => {
                  const code = asWireString(value);
                  if (code !== undefined) {
                    confirms.setAddCode(code);
                  }
                }}
              >
                <SelectTrigger id="ledger-add" className="w-full">
                  <SelectValue placeholder="Supported currency" />
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
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={!confirms.addCode}
              onClick={() => confirms.addCode && actions.startAdd(confirms.addCode)}
            >
              Retrieve coverage
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Default</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Refresh</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.currencies.map((item) => (
                <TableRow key={item.code}>
                  <TableCell>
                    <input
                      type="radio"
                      name="ledger-default"
                      aria-label={`Set ${item.code} as default currency`}
                      checked={state.defaultCurrency === item.code}
                      disabled={item.status !== "enabled"}
                      onChange={() => confirms.askDefault(item.code)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.code}
                    <span className="ml-2 text-muted-foreground">{item.name}</span>
                  </TableCell>
                  <TableCell>{statusLabel(item.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.missingPeriods.length > 0
                      ? `Missing ${item.missingPeriods.join(", ")}`
                      : item.coverageFrom
                        ? `${item.coverageFrom} to ${item.coverageTo}`
                        : "Waiting"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.refreshStatus}
                    {item.lastRefresh ? ` · ${item.lastRefresh}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "adding" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => actions.finishAdd(item.code)}
                        >
                          Coverage ready
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => actions.failAdd(item.code)}
                        >
                          Fail
                        </Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button type="button" size="xs" variant="outline" />}
                        >
                          More
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status === "enabled" && item.code !== state.defaultCurrency ? (
                            <DropdownMenuItem onClick={() => confirms.askDisable(item.code)}>
                              Disable
                            </DropdownMenuItem>
                          ) : null}
                          {item.status === "disabled" || item.status === "failed" ? (
                            <DropdownMenuItem onClick={() => actions.reenable(item.code)}>
                              Re-enable
                            </DropdownMenuItem>
                          ) : null}
                          {item.status === "enabled" && item.code !== state.defaultCurrency ? (
                            <DropdownMenuItem onClick={() => confirms.askDefault(item.code)}>
                              Set as default
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {scene === "form" ? (
        <FieldGroup className="max-w-md border border-border p-4">
          <Field>
            <FieldLabel htmlFor="ledger-amount">Amount</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="ledger-amount"
                value={state.transaction.amount}
                onChange={(event) => actions.setTransactionAmount(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Select
                  items={selectItems}
                  value={state.transaction.currency}
                  onValueChange={(value) => {
                    const code = asWireString(value);
                    if (code !== undefined) {
                      actions.setTransactionCurrency(code);
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="border-0 bg-transparent shadow-none"
                    aria-label="Transaction currency"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {selectItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
            {state.transaction.currency !== state.defaultCurrency && converted ? (
              <FieldDescription>
                {formatMoney(converted, state.defaultCurrency)} at {state.transaction.rate} on{" "}
                {state.transaction.rateDate}. {state.transaction.rateOrigin} rate.
              </FieldDescription>
            ) : null}
          </Field>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRateOpen((open) => !open)}
          >
            {rateOpen ? "Hide rate" : "Adjust rate"}
          </Button>
          {rateOpen ? (
            <Field>
              <FieldLabel htmlFor="ledger-rate">Manual exchange rate</FieldLabel>
              <Input
                id="ledger-rate"
                value={confirms.manualDraft || state.transaction.rate}
                onChange={(event) => confirms.setManualDraft(event.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  confirms.askManualRate(confirms.manualDraft || state.transaction.rate)
                }
              >
                Use this rate
              </Button>
            </Field>
          ) : null}
        </FieldGroup>
      ) : null}

      {scene === "detail" ? (
        <article className="max-w-xl space-y-4 border-b border-border pb-6">
          <h2 className="font-heading text-2xl font-semibold">
            {state.pendingTransaction.description}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular-nums">
                {state.pendingTransaction.status === "resolved" && state.pendingTransaction.rate
                  ? formatMoney(
                      convertToDefault(
                        state.pendingTransaction.originalAmount,
                        state.pendingTransaction.currency,
                        state.defaultCurrency,
                      ) ?? "unavailable",
                      state.defaultCurrency,
                    )
                  : "Incomplete"}
                <p className="text-xs text-muted-foreground">
                  {formatMoney(
                    state.pendingTransaction.originalAmount,
                    state.pendingTransaction.currency,
                  )}{" "}
                  · {state.pendingTransaction.rateOrigin}
                  {state.pendingTransaction.rate ? ` · ${state.pendingTransaction.rate}` : ""}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{state.pendingTransaction.date}</dd>
            </div>
          </dl>
          {state.pendingTransaction.status === "pending" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p>Exchange-rate pending. Cross-currency results stay incomplete.</p>
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
            </div>
          ) : null}
        </article>
      ) : null}

      {scene === "import" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {state.importConfirmed
              ? "Import committed with all listed currency changes."
              : "One confirmation prepares every listed currency and imports every ready row."}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.importNeeds.map((need) => (
                <TableRow key={need.code}>
                  <TableCell>
                    {need.code} {need.name}
                  </TableCell>
                  <TableCell>{need.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{need.coverage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" disabled={state.importConfirmed} onClick={actions.confirmImport}>
            Prepare currencies and import
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
