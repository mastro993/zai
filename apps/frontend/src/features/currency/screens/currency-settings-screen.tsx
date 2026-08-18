import { Result } from "@praha/byethrow";
import { useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { asWireString } from "@/lib/wire";

import { useCurrencyBootstrap } from "../hooks/use-currency-bootstrap";
import type { CurrencySettingsRow } from "../types/currency";

const statusLabel = (status: CurrencySettingsRow["status"]) => {
  if (status === "enabled") return "Enabled";
  if (status === "adding") return "Adding currency";
  if (status === "failed") return "Coverage failed";
  return "Disabled";
};

const refreshLabel = (row: CurrencySettingsRow) => {
  const stamp = row.lastRefresh ? ` · ${row.lastRefresh}` : "";
  return `${row.refreshStatus}${stamp}`;
};

export function CurrencySettingsScreen({ focusRates = false }: { focusRates?: boolean }) {
  const {
    catalog,
    currencies,
    currentJob,
    addCurrency,
    disableCurrency,
    changeDefault,
    retryRefresh,
    cancelJob,
  } = useCurrencyBootstrap();
  const [addCode, setAddCode] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
  const [pendingDisclosure, setPendingDisclosure] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const addable = useMemo(() => {
    const present = new Set(currencies.map((row) => row.code));
    return catalog.filter((item) => !present.has(item.code));
  }, [catalog, currencies]);

  const run = async (work: () => Promise<Result.Result<unknown, { message: string }>>) => {
    setErrorMessage(null);
    const result = await work();
    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
    }
    return result;
  };

  const startAdd = async (code: string, confirm: boolean) => {
    const result = await addCurrency(code, confirm);
    if (Result.isFailure(result) && result.error.code === "providerDisclosureRequired") {
      setPendingDisclosure(code);
      return;
    }
    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-56">
          <FieldLabel htmlFor="currency-add">Add currency</FieldLabel>
          <Select
            items={addable.map((item) => ({
              value: item.code,
              label: `${item.code} ${item.name}`,
            }))}
            value={addCode}
            onValueChange={(value) => {
              const code = asWireString(value);
              if (code !== undefined) {
                setAddCode(code);
              }
            }}
          >
            <SelectTrigger id="currency-add" className="w-full">
              <SelectValue placeholder="Supported currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {addable.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!addCode}
          onClick={() => {
            if (addCode) {
              void startAdd(addCode, false);
            }
          }}
        >
          Add
        </Button>
        {currentJob?.status === "running" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void run(() => cancelJob(currentJob.jobId));
            }}
          >
            Cancel job
          </Button>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Default</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead data-focus={focusRates ? "rates" : undefined}>Refresh</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currencies.map((item) => (
            <TableRow key={item.code}>
              <TableCell>
                <input
                  type="radio"
                  name="currency-default"
                  aria-label={`Set ${item.code} as default currency`}
                  checked={item.isDefault}
                  disabled={item.status !== "enabled"}
                  onChange={() => setPendingDefault(item.code)}
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
              <TableCell className="text-xs">{refreshLabel(item)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button type="button" size="xs" variant="outline" />}
                    disabled={item.status === "adding"}
                  >
                    Menu
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.status === "enabled" && !item.isDefault ? (
                      <DropdownMenuItem onClick={() => setPendingDisable(item.code)}>
                        Disable
                      </DropdownMenuItem>
                    ) : null}
                    {item.status === "disabled" || item.status === "failed" ? (
                      <DropdownMenuItem
                        onClick={() => {
                          void startAdd(item.code, false);
                        }}
                      >
                        Re-enable
                      </DropdownMenuItem>
                    ) : null}
                    {item.status === "enabled" && !item.isDefault ? (
                      <DropdownMenuItem onClick={() => setPendingDefault(item.code)}>
                        Set as default
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            void retryRefresh().finally(() => setRetrying(false));
          }}
        >
          Retry now
        </Button>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <ConfirmationDialog
        open={pendingDisable !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisable(null);
        }}
        title={pendingDisable ? `Disable ${pendingDisable}?` : "Disable currency?"}
        description="It cannot be selected for new transactions or as the default. Existing history and recurring templates stay. Disable is reversible."
      >
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (pendingDisable) {
              void run(() => disableCurrency(pendingDisable));
            }
            setPendingDisable(null);
          }}
        >
          Disable
        </Button>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pendingDefault !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDefault(null);
        }}
        title={
          pendingDefault ? `Use ${pendingDefault} as default currency?` : "Change default currency?"
        }
        description="The current default stays active until the new generation is complete. Cancel or failure leaves the previous default in place."
      >
        <Button
          size="sm"
          onClick={() => {
            if (pendingDefault) {
              void run(() => changeDefault(pendingDefault));
            }
            setPendingDefault(null);
          }}
        >
          Change default
        </Button>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pendingDisclosure !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisclosure(null);
        }}
        title="Use European Central Bank rates?"
        description="Zai will retrieve ECB euro reference rates automatically, including ordinary network metadata such as the request time and this app version. Zai sends no financial data, amounts, categories, or identifiers."
      >
        <Button
          size="sm"
          onClick={() => {
            if (pendingDisclosure) {
              void startAdd(pendingDisclosure, true);
            }
            setPendingDisclosure(null);
          }}
        >
          Enable ECB rates
        </Button>
      </ConfirmationDialog>
    </div>
  );
}
