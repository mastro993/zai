import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format, parseISO } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "@tanstack/react-router";
import { isoFractionDigits } from "@/lib/currency";
import { asWireString } from "@/lib/wire";

import { TransactionCategoryCombobox } from "./transaction-category-combobox";
import {
  ConversionRateField,
  ConvertedAmountDescription,
  useTransactionConversion,
} from "./transaction-form-conversion";
import type { TransactionRecurringProvenance } from "@/features/recurring-transactions/types/recurring-transaction";
import { AddCurrencySelectFooter } from "@/features/currency/components/add-currency-select-footer";
import { useCurrencyBootstrap } from "@/features/currency/hooks/use-currency-bootstrap";
import type { CurrencySettingsRow } from "@/features/currency/types/currency";

import {
  combineDateTime,
  formatAmountFromMinor,
  isPartialAmountInput,
  normalizeAmountInput,
  splitDateTime,
  toDateTimeInputValue,
} from "../lib/transaction";
import { getLastUsedTransactionCurrency } from "../lib/last-used-currency";
import { quoteDateFromInput } from "../lib/transaction-write";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  TRANSACTION_TYPES,
  transactionFormSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

const getLocalDateTimeInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const TRANSACTION_TYPE_CONTROLS = {
  expense: { icon: ArrowDownRight01Icon, iconClassName: "text-destructive" },
  income: { icon: ArrowUpRight01Icon, iconClassName: "text-primary" },
} as const;

const selectableCodes = (currencies: Array<CurrencySettingsRow>, current: string | undefined) => {
  const enabled = currencies.filter((row) => row.status === "enabled").map((row) => row.code);
  if (current && !enabled.includes(current)) {
    return [current, ...enabled];
  }
  return enabled;
};

const getFormDefaults = (
  mode: TransactionFormMode,
  defaultCurrency: string,
  enabledCodes: Array<string>,
): TransactionFormInput => {
  if (mode.type === "create") {
    const lastUsed = getLastUsedTransactionCurrency();
    const currency =
      lastUsed && (enabledCodes.length === 0 || enabledCodes.includes(lastUsed))
        ? lastUsed
        : defaultCurrency;
    return {
      description: "",
      amount: formatAmountFromMinor(0, isoFractionDigits(currency)),
      currency,
      transactionDate: getLocalDateTimeInputValue(),
      transactionType: "expense",
      transactionCategoryId: "",
      notes: "",
      manualExchangeRate: "",
    };
  }

  return {
    description: mode.transaction.description ?? "",
    amount: formatAmountFromMinor(
      mode.transaction.amount,
      isoFractionDigits(mode.transaction.currency),
    ),
    currency: mode.transaction.currency,
    transactionDate: toDateTimeInputValue(mode.transaction.transactionDate),
    transactionType:
      mode.transaction.transactionType === "income" ||
      mode.transaction.transactionType === "expense"
        ? mode.transaction.transactionType
        : "expense",
    transactionCategoryId: mode.transaction.transactionCategoryId ?? "",
    notes: mode.transaction.notes ?? "",
    manualExchangeRate: "",
  };
};

const getFormCopy = (mode: TransactionFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit transaction",
      description: "Update the amount, date, or category. Changes apply to this entry only.",
    };
  }

  return {
    title: "New transaction",
    description: "Record income or an expense",
  };
};

const formatDateLabel = (dateValue: string) => {
  if (!dateValue) {
    return "Pick a date";
  }

  return format(parseISO(dateValue), "MMM d, yyyy");
};

function TransactionFormDrawer({
  mode,
  categories,
  onSubmit,
  open = true,
  recurringProvenance = null,
}: {
  mode: TransactionFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  open?: boolean;
  recurringProvenance?: TransactionRecurringProvenance | null;
}) {
  const { defaultCurrency, currencies } = useCurrencyBootstrap();
  const resolvedDefault = defaultCurrency ?? "EUR";
  const enabledCodes = useMemo(
    () => currencies.filter((row) => row.status === "enabled").map((row) => row.code),
    [currencies],
  );
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getFormDefaults(mode, resolvedDefault, enabledCodes),
  });
  const { control, register, setValue } = form;
  const amountInputRef = useRef<HTMLInputElement>(null);
  const { title, description } = getFormCopy(mode);
  const isCreate = mode.type === "create";
  const { errors, isSubmitting } = form.formState;
  const amountErrorId = "transaction-amount-error";
  const dateErrorId = "transaction-date-error";
  const typeErrorId = "transaction-type-error";
  const visibleSource = recurringProvenance?.source;
  const watchedCurrency = useWatch({ control, name: "currency" }) ?? resolvedDefault;
  const previousCurrencyRef = useRef(watchedCurrency);
  const currencyItems = useMemo(() => {
    const keepCurrent = isCreate ? enabledCodes.includes(watchedCurrency) : true;
    const codes = selectableCodes(currencies, keepCurrent ? watchedCurrency : undefined);
    return codes.map((code) => ({ value: code, label: code }));
  }, [currencies, enabledCodes, isCreate, watchedCurrency]);
  const fractionDigits = isoFractionDigits(watchedCurrency);
  const conversion = useTransactionConversion({
    control,
    defaultCurrency: resolvedDefault,
    lockedRate: mode.type === "edit" ? mode.transaction.exchangeRate : null,
    lockedCurrency: mode.type === "edit" ? mode.transaction.currency : null,
    lockedDate: mode.type === "edit" ? quoteDateFromInput(mode.transaction.transactionDate) : null,
  });

  useEffect(() => {
    if (!isCreate || enabledCodes.length === 0) {
      return;
    }
    if (!enabledCodes.includes(watchedCurrency)) {
      setValue("currency", resolvedDefault);
    }
  }, [enabledCodes, isCreate, resolvedDefault, setValue, watchedCurrency]);

  useEffect(() => {
    if (previousCurrencyRef.current === watchedCurrency) {
      return;
    }
    previousCurrencyRef.current = watchedCurrency;
    setValue("manualExchangeRate", "");
  }, [setValue, watchedCurrency]);

  return (
    <DrawerContent
      className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem]"
      initialFocus={isCreate ? amountInputRef : undefined}
    >
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
        {visibleSource ? (
          <p className="pt-2 text-sm">
            <Link
              to="/cash-flow/recurring/$recurringTransactionId"
              params={{ recurringTransactionId: visibleSource.id }}
              className="underline-offset-4 hover:underline"
              aria-label={`Open recurring source ${visibleSource.description}`}
            >
              Part of recurring: {visibleSource.description}
            </Link>
          </p>
        ) : null}
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FieldGroup className="flex-1 overflow-y-auto p-4">
          <Field data-invalid={Boolean(errors.transactionType)}>
            <FieldLabel>Type</FieldLabel>
            <Controller
              control={control}
              name="transactionType"
              render={({ field }) => (
                <ToggleGroup
                  aria-describedby={errors.transactionType ? typeErrorId : undefined}
                  aria-invalid={Boolean(errors.transactionType)}
                  aria-label="Transaction type"
                  className="w-full"
                  spacing={0}
                  variant="outline"
                  value={[field.value]}
                  onValueChange={(values) => {
                    const nextValue = values.at(-1);

                    if (nextValue === "expense" || nextValue === "income") {
                      field.onChange(nextValue);
                    }
                  }}
                >
                  {TRANSACTION_TYPES.map((type) => (
                    <ToggleGroupItem key={type} value={type} className="flex-1 gap-1.5 capitalize">
                      <HugeiconsIcon
                        icon={TRANSACTION_TYPE_CONTROLS[type].icon}
                        className={TRANSACTION_TYPE_CONTROLS[type].iconClassName}
                        strokeWidth={2}
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      {type}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
            <FieldError id={typeErrorId}>{errors.transactionType?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.amount)}>
            <FieldLabel htmlFor="transaction-amount">Amount</FieldLabel>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <InputGroup>
                  <InputGroupInput
                    id="transaction-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder={formatAmountFromMinor(0, fractionDigits)}
                    aria-describedby={errors.amount ? amountErrorId : undefined}
                    aria-invalid={Boolean(errors.amount)}
                    value={field.value ?? ""}
                    onBlur={(event) => {
                      field.onBlur();
                      const normalized = normalizeAmountInput(event.target.value, fractionDigits);

                      if (normalized !== event.target.value) {
                        field.onChange(normalized);
                      }
                    }}
                    name={field.name}
                    ref={(element) => {
                      field.ref(element);
                      amountInputRef.current = element;
                    }}
                    onChange={(event) => {
                      const nextValue = event.target.value;

                      if (isPartialAmountInput(nextValue, fractionDigits)) {
                        field.onChange(nextValue);
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <Controller
                      control={control}
                      name="currency"
                      render={({ field: currencyField }) => (
                        <Select
                          items={currencyItems}
                          value={currencyField.value}
                          onValueChange={(value) => {
                            const code = asWireString(value);
                            if (code !== undefined) {
                              currencyField.onChange(code);
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
                              {currencyItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.value}
                                </SelectItem>
                              ))}
                              <AddCurrencySelectFooter />
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </InputGroupAddon>
                </InputGroup>
              )}
            />
            <ConvertedAmountDescription
              pending={conversion.convertedPending}
              text={conversion.convertedDescription}
            />
            <FieldError id={amountErrorId}>{errors.amount?.message}</FieldError>
          </Field>

          {conversion.showRateField ? (
            <ConversionRateField placeholder={conversion.placeholder} register={register} />
          ) : null}

          <Field data-invalid={Boolean(errors.transactionDate)}>
            <FieldLabel>Date and time</FieldLabel>
            <Controller
              control={control}
              name="transactionDate"
              render={({ field }) => {
                const { date, time } = splitDateTime(field.value);
                const selectedDate = date ? parseISO(date) : undefined;

                return (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="min-w-0 flex-1 justify-start font-normal"
                            aria-describedby={errors.transactionDate ? dateErrorId : undefined}
                            aria-invalid={Boolean(errors.transactionDate)}
                          />
                        }
                      >
                        <HugeiconsIcon
                          icon={Calendar03Icon}
                          strokeWidth={2}
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        {formatDateLabel(date)}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(nextDate) => {
                            if (!nextDate) {
                              return;
                            }

                            field.onChange(combineDateTime(format(nextDate, "yyyy-MM-dd"), time));
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <InputGroup className="w-28 shrink-0">
                      <InputGroupInput
                        id="transaction-time"
                        type="time"
                        step="60"
                        className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                        aria-label="Time"
                        aria-invalid={Boolean(errors.transactionDate)}
                        defaultValue={time}
                        onChange={(event) => {
                          field.onChange(combineDateTime(date, event.target.value));
                        }}
                      />
                      <InputGroupAddon align="inline-start">
                        <HugeiconsIcon
                          icon={Clock01Icon}
                          strokeWidth={2}
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                );
              }}
            />
            <FieldError id={dateErrorId}>{errors.transactionDate?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-category-trigger">Category</FieldLabel>
            <Controller
              control={control}
              name="transactionCategoryId"
              render={({ field }) => (
                <TransactionCategoryCombobox
                  id="transaction-category-trigger"
                  categories={categories}
                  value={field.value ? field.value : null}
                  onChange={(next) => field.onChange(next ?? "")}
                  onBlur={field.onBlur}
                  parentOpen={open}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-description">Description</FieldLabel>
            <Input
              id="transaction-description"
              placeholder="Coffee, salary, rent..."
              {...form.register("description")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-notes">Notes</FieldLabel>
            <Textarea
              id="transaction-notes"
              placeholder="Optional details for your own reference"
              className="min-h-16 resize-y"
              {...form.register("notes")}
            />
          </Field>
        </FieldGroup>

        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save transaction"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { TransactionFormDrawer };
