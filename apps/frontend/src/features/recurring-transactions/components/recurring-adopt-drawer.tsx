import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Infinity01Icon,
  LeftToRightListNumberIcon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { Result } from "@praha/byethrow";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CommandError } from "@/commands/errors";
import type { TransactionCategory } from "@/features/categories/types/model";
import { TransactionTypeBadge } from "@/features/transactions/components/transaction-type-badge";
import type { Transaction } from "@/features/transactions/types/model";
import { formatCurrencyFromMinor } from "@/lib/currency";
import { cn } from "@/lib/utils";

import { previewRecurringAdoption } from "@/features/recurring-transactions/commands/recurring-transactions";
import { formatLocalDateTime } from "../lib/recurring";
import {
  SCHEDULE_INTERVAL_UNITS,
  adoptRecurringFormSchema,
  type AdoptRecurringFormInput,
  type AdoptRecurringFormValues,
  type RecurringAdoptOutcome,
} from "../types/recurring-transaction";

interface RecurringAdoptDrawerProps {
  open: boolean;
  transaction: Transaction;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: AdoptRecurringFormValues,
  ) => Promise<Result.Result<RecurringAdoptOutcome, CommandError>>;
  categories: Array<TransactionCategory>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const defaultsFromTransaction = (): AdoptRecurringFormInput => ({
  scheduleKind: "interval",
  intervalEvery: "1",
  intervalUnit: "month",
  monthlyDay: "1",
  totalMode: "indefinite",
  totalOccurrences: "",
});

const getScheduleIntervalUnitItems = (every: string | undefined) =>
  SCHEDULE_INTERVAL_UNITS.map((unit) => ({
    value: unit,
    label: Number(every) === 1 ? unit : `${unit}s`,
  }));

interface RecurringOption {
  value: string;
  label: string;
  description: string;
  icon:
    | typeof RepeatIcon
    | typeof Calendar03Icon
    | typeof Infinity01Icon
    | typeof LeftToRightListNumberIcon;
}

const SCHEDULE_KIND_OPTIONS: Array<RecurringOption> = [
  {
    value: "interval",
    label: "Interval",
    description: "Repeat after a set interval.",
    icon: RepeatIcon,
  },
  {
    value: "monthlyDay",
    label: "Monthly day",
    description: "Repeat on the same day each month.",
    icon: Calendar03Icon,
  },
];

const TOTAL_MODE_OPTIONS: Array<RecurringOption> = [
  {
    value: "indefinite",
    label: "Indefinite",
    description: "Continue until you stop the recurring transaction.",
    icon: Infinity01Icon,
  },
  {
    value: "finite",
    label: "Finite",
    description: "Stop after a set number of occurrences.",
    icon: LeftToRightListNumberIcon,
  },
];

interface RecurringOptionComboboxProps {
  id: string;
  ariaLabel: string;
  options: Array<RecurringOption>;
  value: string | undefined;
  onChange: (value: string) => void;
}

function RecurringOptionCombobox({
  id,
  ariaLabel,
  options,
  value,
  onChange,
}: RecurringOptionComboboxProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <Combobox
      items={options}
      value={selected ?? null}
      filter={null}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      onValueChange={(nextOption) => {
        if (nextOption) {
          onChange(nextOption.value);
        }
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            className="h-8 w-full min-w-0 justify-between gap-2 overflow-hidden px-2.5 font-normal"
          />
        }
      >
        <ComboboxValue>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <HugeiconsIcon icon={selected.icon} data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">Select an option</span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>

      <ComboboxContent aria-label={`Select ${ariaLabel.toLowerCase()}`}>
        <ComboboxList>
          {(option) => (
            <ComboboxItem
              key={option.value}
              value={option}
              className={cn(
                "items-center gap-3 border border-transparent py-2.5 pl-2 [&>span[data-selected]]:top-1/2 [&>span[data-selected]]:-translate-y-1/2 [&>span[data-selected]]:text-primary",
                selected?.value === option.value
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/5 focus:bg-primary/5"
                  : null,
              )}
            >
              <span
                data-slot="recurring-option-icon"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border",
                  selected?.value === option.value
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
                aria-hidden="true"
              >
                <HugeiconsIcon icon={option.icon} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-4 text-pretty text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function RecurringAdoptDrawer({
  open,
  transaction,
  onOpenChange,
  onSubmit,
  categories,
  returnFocusRef,
}: RecurringAdoptDrawerProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdoptRecurringFormInput, unknown, AdoptRecurringFormValues>({
    resolver: zodResolver(adoptRecurringFormSchema),
    defaultValues: defaultsFromTransaction(),
  });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const totalMode = useWatch({ control, name: "totalMode" });
  const intervalEvery = useWatch({ control, name: "intervalEvery" });
  const intervalUnit = useWatch({ control, name: "intervalUnit" });
  const monthlyDay = useWatch({ control, name: "monthlyDay" });
  const totalOccurrences = useWatch({ control, name: "totalOccurrences" });
  const intervalUnitItems = getScheduleIntervalUnitItems(intervalEvery);
  const [laterDueCount, setLaterDueCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string>();

  useEffect(() => {
    reset(defaultsFromTransaction());
  }, [reset, transaction.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const every = Number(intervalEvery);
    const day = Number(monthlyDay);
    const total = Number(totalOccurrences);
    const scheduleValid =
      scheduleKind === "interval"
        ? Number.isInteger(every) && every >= 1
        : Number.isInteger(day) && day >= 1 && day <= 31;
    const totalValid = totalMode === "indefinite" || (Number.isInteger(total) && total >= 1);
    if (!scheduleValid || !totalValid) {
      setLaterDueCount(null);
      setPreviewError(undefined);
      return;
    }

    const values: AdoptRecurringFormValues = {
      scheduleKind,
      intervalEvery: String(every || 1),
      intervalUnit: intervalUnit ?? "month",
      monthlyDay: String(day || 1),
      totalMode: totalMode ?? "indefinite",
      totalOccurrences: totalMode === "finite" ? String(total) : undefined,
    };

    void previewRecurringAdoption(transaction.id, values).then((result) => {
      if (cancelled) {
        return;
      }
      if (Result.isFailure(result)) {
        setPreviewError(result.error.message);
        setLaterDueCount(null);
        return;
      }
      setPreviewError(undefined);
      setLaterDueCount(result.value.laterDueCount);
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    transaction.id,
    scheduleKind,
    intervalEvery,
    intervalUnit,
    monthlyDay,
    totalMode,
    totalOccurrences,
  ]);

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Recurring transaction adopted");
    onOpenChange(false);
  });

  return (
    <DrawerContent
      className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96"
      finalFocus={returnFocusRef}
    >
      <DrawerHeader>
        <DrawerTitle>Adopt as recurring</DrawerTitle>
        <DrawerDescription>
          This transaction becomes occurrence 1. Review its details, then set schedule and total
          occurrences.
        </DrawerDescription>
      </DrawerHeader>
      <form className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4" onSubmit={submit}>
        <section
          aria-labelledby="adopt-recurring-snapshot-title"
          className="rounded-lg border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="adopt-recurring-snapshot-title" className="text-sm font-medium">
              Transaction snapshot
            </h2>
            <p className="text-sm text-muted-foreground">These details stay unchanged.</p>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd>{transaction.description?.trim() || "No description"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular-nums">{formatCurrencyFromMinor(transaction.amount, "EUR")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>
                <TransactionTypeBadge type={transaction.transactionType} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Original date</dt>
              <dd>{formatLocalDateTime(transaction.transactionDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd>
                {transaction.transactionCategoryId
                  ? (categories.find(
                      (category) => category.id === transaction.transactionCategoryId,
                    )?.name ?? "Category unavailable")
                  : "Uncategorized"}
              </dd>
            </div>
            {transaction.notes?.trim() ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{transaction.notes.trim()}</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="adopt-recurring-schedule">Schedule</FieldLabel>
              <Controller
                control={control}
                name="scheduleKind"
                render={({ field }) => (
                  <RecurringOptionCombobox
                    id="adopt-recurring-schedule"
                    ariaLabel="Schedule"
                    options={SCHEDULE_KIND_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>

            {scheduleKind === "interval" ? (
              <Field data-invalid={Boolean(errors.intervalEvery)}>
                <FieldLabel htmlFor="adopt-recurring-every">Every</FieldLabel>
                <ButtonGroup aria-label="Interval schedule" className="w-full">
                  <Input
                    id="adopt-recurring-every"
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.intervalEvery)}
                    {...register("intervalEvery")}
                  />
                  <Controller
                    control={control}
                    name="intervalUnit"
                    render={({ field }) => (
                      <Select
                        items={intervalUnitItems}
                        value={field.value ?? "month"}
                        onValueChange={(value) => {
                          if (value) {
                            field.onChange(value);
                          }
                        }}
                      >
                        <SelectTrigger aria-label="Interval unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {intervalUnitItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </ButtonGroup>
                <FieldError>{errors.intervalEvery?.message}</FieldError>
              </Field>
            ) : (
              <Field data-invalid={Boolean(errors.monthlyDay)}>
                <FieldLabel htmlFor="adopt-recurring-monthly-day">Day of month</FieldLabel>
                <Input
                  id="adopt-recurring-monthly-day"
                  inputMode="numeric"
                  {...register("monthlyDay")}
                />
                <FieldError>{errors.monthlyDay?.message}</FieldError>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="adopt-recurring-total-mode">Total occurrences</FieldLabel>
              <Controller
                control={control}
                name="totalMode"
                render={({ field }) => (
                  <RecurringOptionCombobox
                    id="adopt-recurring-total-mode"
                    ariaLabel="Total occurrences"
                    options={TOTAL_MODE_OPTIONS}
                    value={field.value ?? "indefinite"}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
            {totalMode === "finite" ? (
              <Field data-invalid={Boolean(errors.totalOccurrences)}>
                <FieldLabel htmlFor="adopt-recurring-total">Number of occurrences</FieldLabel>
                <Input
                  id="adopt-recurring-total"
                  type="number"
                  inputMode="numeric"
                  {...register("totalOccurrences")}
                />
                <FieldError>{errors.totalOccurrences?.message}</FieldError>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
        <DrawerFooter className="p-0">
          <p className="rounded-md border border-border px-3 py-2 text-sm" role="status">
            First occurrence stays {formatLocalDateTime(transaction.transactionDate)}.
            {laterDueCount === null
              ? previewError
                ? ` Preview unavailable: ${previewError}`
                : " Calculating later due occurrences…"
              : laterDueCount === 0
                ? " No later due occurrences will be created on confirm."
                : ` Confirming will catch up ${laterDueCount} later due occurrence${laterDueCount === 1 ? "" : "s"}.`}
          </p>
          <Button type="submit" disabled={isSubmitting || !open || laterDueCount === null}>
            {isSubmitting ? "Adopting..." : "Confirm adoption"}
          </Button>
          <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}
