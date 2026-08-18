import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Clock01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
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
import type { CommandError } from "@/commands/errors";
import type { TransactionCategory } from "@/features/categories/types/model";
import { TransactionCategoryCombobox } from "@/features/transactions/components/transaction-category-combobox";
import { isoFractionDigits } from "@/lib/currency";
import {
  combineDateTime,
  isPartialAmountInput,
  normalizeAmountInput,
  splitDateTime,
} from "@/features/transactions/lib/transaction";

import { setLastUsedTransactionCurrency } from "@/features/transactions/lib/last-used-currency";
import { previewRecurringAdoption } from "../commands/recurring-transactions";
import {
  createRecurringFormDefaults,
  formatRecurringOrdinal,
  getRecurringFormCopy,
  getRecurringFormDefaults,
  getScheduleIntervalUnitItems,
} from "../lib/recurring-form";
import type { RecurringFormMode } from "../types/recurring-form-mode";
import {
  TRANSACTION_TYPES,
  recurringFormSchema,
  type RecurringAdoptOutcome,
  type RecurringCreateOutcome,
  type RecurringFormInput,
  type RecurringFormValues,
  type RecurringMutationOutcome,
} from "../types/recurring-transaction";

const TRANSACTION_TYPE_CONTROLS = {
  expense: { icon: ArrowDown01Icon, iconClassName: "text-destructive" },
  income: { icon: ArrowUp01Icon, iconClassName: "text-primary" },
} as const;

const SCHEDULE_KIND_OPTIONS = [
  { value: "interval", label: "Every" },
  { value: "monthlyDay", label: "On" },
] as const;

const MONTHLY_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = index + 1;
  return { value: String(value), label: formatRecurringOrdinal(value) };
});

const formatDateLabel = (dateValue: string) => {
  if (!dateValue) {
    return "Pick a date";
  }

  return format(parseISO(dateValue), "MMM d, yyyy");
};

interface RecurringFormDrawerProps {
  mode: RecurringFormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: RecurringFormValues,
  ) => Promise<
    Result.Result<
      RecurringAdoptOutcome | RecurringCreateOutcome | RecurringMutationOutcome,
      CommandError
    >
  >;
  categories: Array<TransactionCategory>;
  configurationEditable?: boolean;
  descriptionEditable?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function RecurringFormDrawer({
  mode,
  open,
  onOpenChange,
  onSubmit,
  categories,
  configurationEditable = true,
  descriptionEditable = true,
  returnFocusRef,
}: RecurringFormDrawerProps) {
  const copy = getRecurringFormCopy(mode);
  const isEdit = mode.type === "edit";
  const isAdopt = mode.type === "adopt";
  const configLocked = isEdit && !configurationEditable;
  const templateLocked = isAdopt || configLocked;
  const descriptionLocked = isAdopt || (isEdit && !descriptionEditable);
  const lockedCategoryId =
    mode.type === "edit"
      ? mode.document.template.transactionCategoryId
      : mode.type === "adopt"
        ? mode.transaction.transactionCategoryId
        : undefined;
  const lockedCategoryName = lockedCategoryId
    ? (categories.find((category) => category.id === lockedCategoryId)?.name ??
      "Category unavailable")
    : "Uncategorized";
  const adoptTransactionId = mode.type === "adopt" ? mode.transaction.id : undefined;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormInput, unknown, RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: getRecurringFormDefaults(mode),
  });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const intervalEvery = useWatch({ control, name: "intervalEvery" });
  const intervalUnit = useWatch({ control, name: "intervalUnit" });
  const monthlyDay = useWatch({ control, name: "monthlyDay" });
  const totalOccurrences = useWatch({ control, name: "totalOccurrences" });
  const currency = useWatch({ control, name: "currency" }) ?? "EUR";
  const fractionDigits = isoFractionDigits(currency);
  const amountErrorId = "recurring-amount-error";
  const dateErrorId = "recurring-first-error";
  const scheduleErrorId = "recurring-schedule-error";
  const totalDescriptionId = "recurring-total-description";
  const totalErrorId = "recurring-total-error";
  const typeErrorId = "recurring-type-error";
  const intervalUnitItems = getScheduleIntervalUnitItems(intervalEvery);
  const [laterDueCount, setLaterDueCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string>();

  useEffect(() => {
    if (!open || !adoptTransactionId) {
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
    const totalValid = !totalOccurrences || (Number.isInteger(total) && total >= 1);
    if (!scheduleValid || !totalValid) {
      setLaterDueCount(null);
      setPreviewError(undefined);
      return;
    }

    setLaterDueCount(null);
    setPreviewError(undefined);
    void previewRecurringAdoption(adoptTransactionId, {
      scheduleKind,
      intervalEvery: String(every || 1),
      intervalUnit: intervalUnit ?? "month",
      monthlyDay: String(day || 1),
      totalOccurrences: totalOccurrences ?? "",
    }).then((result) => {
      if (cancelled) {
        return;
      }
      if (Result.isFailure(result)) {
        setPreviewError(result.error.message);
        setLaterDueCount(null);
        return;
      }
      setLaterDueCount(result.value.laterDueCount);
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    adoptTransactionId,
    scheduleKind,
    intervalEvery,
    intervalUnit,
    monthlyDay,
    totalOccurrences,
  ]);

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (Result.isFailure(result)) {
      toast.error(
        result.error.code === "revisionConflict"
          ? "Recurring transaction changed elsewhere. Reload before editing again."
          : result.error.message,
      );
      return;
    }
    if ("outcome" in result.value && result.value.outcome === "unchanged") {
      toast.message(
        result.value.reason === "same_value"
          ? "No changes to apply."
          : result.value.reason === "generation_blocked"
            ? "Repair the generation failure before editing schedule, template, or count."
            : "This recurring transaction cannot be fully edited in the current state.",
      );
    } else {
      toast.success(copy.successMessage);
    }
    if (mode.type === "create") {
      setLastUsedTransactionCurrency(values.currency);
      reset(createRecurringFormDefaults());
    }
    onOpenChange(false);
  });

  return (
    <DrawerContent
      className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96"
      finalFocus={returnFocusRef}
    >
      <DrawerHeader>
        <DrawerTitle>{copy.title}</DrawerTitle>
        <DrawerDescription>{copy.description}</DrawerDescription>
      </DrawerHeader>
      <form className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-4 pb-4" onSubmit={submit}>
        <input type="hidden" {...register("currency")} />
        <FieldSet>
          <FieldGroup>
            {configLocked ? (
              <FieldDescription>
                Schedule, template amount/type/category/notes, and count are locked while this
                source is stopped, completed, or needs attention. Description editing remains
                available when the source is still visible.
              </FieldDescription>
            ) : null}

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
                    disabled={templateLocked}
                    value={[field.value ?? "expense"]}
                    onValueChange={(value) => {
                      const nextValue = value.at(-1);

                      if (nextValue === "expense" || nextValue === "income") {
                        field.onChange(nextValue);
                      }
                    }}
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <ToggleGroupItem
                        key={type}
                        value={type}
                        className="flex-1 gap-1.5 capitalize"
                      >
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
              <FieldLabel htmlFor="recurring-amount">Amount</FieldLabel>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <InputGroup>
                    <InputGroupInput
                      id="recurring-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      disabled={templateLocked}
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
                      ref={field.ref}
                      onChange={(event) => {
                        const nextValue = event.target.value;

                        if (isPartialAmountInput(nextValue, fractionDigits)) {
                          field.onChange(nextValue);
                        }
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{currency}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                )}
              />
              <FieldError id={amountErrorId}>{errors.amount?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel
                htmlFor={
                  templateLocked ? "recurring-category-locked" : "recurring-category-trigger"
                }
              >
                Category
              </FieldLabel>
              {templateLocked ? (
                <Input id="recurring-category-locked" disabled value={lockedCategoryName} />
              ) : (
                <Controller
                  control={control}
                  name="transactionCategoryId"
                  render={({ field }) => (
                    <TransactionCategoryCombobox
                      id="recurring-category-trigger"
                      categories={categories}
                      onChange={(value) => field.onChange(value ?? undefined)}
                      onBlur={field.onBlur}
                      parentOpen={open}
                      value={field.value ?? null}
                    />
                  )}
                />
              )}
            </Field>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="recurring-description">Description</FieldLabel>
              <Input
                id="recurring-description"
                placeholder="Coffee, salary, rent..."
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
                disabled={descriptionLocked}
              />
              <FieldError>{errors.description?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-notes">Notes</FieldLabel>
              <Textarea
                id="recurring-notes"
                placeholder="Optional details for your own reference"
                className="min-h-16 resize-y"
                {...register("notes")}
                disabled={templateLocked}
              />
            </Field>

            {isAdopt ? (
              <Alert className="bg-secondary text-secondary-foreground">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="text-primary"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <AlertTitle className="text-primary">Source transaction</AlertTitle>
                <AlertDescription>
                  Transaction details and first occurrence come from the source transaction and
                  cannot be changed here.
                </AlertDescription>
              </Alert>
            ) : null}

            <FieldSeparator />

            <Field data-invalid={Boolean(errors.firstScheduledLocal)}>
              <FieldLabel htmlFor="recurring-first-date">
                {isEdit ? "Next occurrence" : "First occurrence"}
              </FieldLabel>
              <Controller
                control={control}
                name="firstScheduledLocal"
                render={({ field }) => {
                  const { date, time } = splitDateTime(field.value);
                  const selectedDate = date ? parseISO(date) : undefined;

                  return (
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              id="recurring-first-date"
                              type="button"
                              variant="outline"
                              className="min-w-0 flex-1 justify-start font-normal"
                              aria-describedby={
                                errors.firstScheduledLocal ? dateErrorId : undefined
                              }
                              aria-invalid={Boolean(errors.firstScheduledLocal)}
                              disabled={isAdopt || configLocked}
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
                          id="recurring-first-time"
                          type="time"
                          step="60"
                          className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          aria-label="Time"
                          aria-describedby={errors.firstScheduledLocal ? dateErrorId : undefined}
                          aria-invalid={Boolean(errors.firstScheduledLocal)}
                          defaultValue={time}
                          disabled={isAdopt || configLocked}
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
              <FieldError id={dateErrorId}>{errors.firstScheduledLocal?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.intervalEvery || errors.monthlyDay)}>
              <FieldLabel>Schedule</FieldLabel>
              <ButtonGroup
                aria-describedby={
                  errors.intervalEvery || errors.monthlyDay ? scheduleErrorId : undefined
                }
                aria-label="Schedule"
                className="w-full"
              >
                <Controller
                  control={control}
                  name="scheduleKind"
                  render={({ field }) => (
                    <Select
                      items={SCHEDULE_KIND_OPTIONS}
                      value={field.value}
                      onValueChange={(value) => {
                        if (value === "interval" || value === "monthlyDay") {
                          field.onChange(value);
                        }
                      }}
                    >
                      <SelectTrigger aria-label="Schedule mode" disabled={configLocked}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {SCHEDULE_KIND_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {scheduleKind === "interval" ? (
                  <>
                    <Input
                      aria-label="Interval value"
                      aria-invalid={Boolean(errors.intervalEvery)}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      readOnly={configLocked}
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
                          <SelectTrigger aria-label="Interval unit" disabled={configLocked}>
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
                  </>
                ) : (
                  <>
                    <Controller
                      control={control}
                      name="monthlyDay"
                      render={({ field }) => (
                        <Select
                          items={MONTHLY_DAY_OPTIONS}
                          value={field.value ?? "1"}
                          onValueChange={(value) => {
                            if (value) {
                              field.onChange(value);
                            }
                          }}
                        >
                          <SelectTrigger
                            aria-label="Monthly day"
                            className="w-full"
                            disabled={configLocked}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              {MONTHLY_DAY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <ButtonGroupText className="shrink-0 px-2.5 font-normal text-muted-foreground">
                      of the month
                    </ButtonGroupText>
                  </>
                )}
              </ButtonGroup>
              <FieldError id={scheduleErrorId}>
                {scheduleKind === "interval"
                  ? errors.intervalEvery?.message
                  : errors.monthlyDay?.message}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.totalOccurrences)}>
              <FieldLabel htmlFor="recurring-total">Occurrences</FieldLabel>
              <Input
                id="recurring-total"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Until stopped"
                readOnly={configLocked}
                aria-describedby={
                  errors.totalOccurrences
                    ? `${totalDescriptionId} ${totalErrorId}`
                    : totalDescriptionId
                }
                aria-invalid={Boolean(errors.totalOccurrences)}
                {...register("totalOccurrences")}
              />
              <FieldDescription id={totalDescriptionId}>
                {isAdopt
                  ? "Includes this transaction as occurrence 1. Leave blank to continue until stopped."
                  : "Enter a number to stop after that many occurrences. Leave blank to continue until you stop the recurring transaction."}
              </FieldDescription>
              <FieldError id={totalErrorId}>{errors.totalOccurrences?.message}</FieldError>
            </Field>
          </FieldGroup>
        </FieldSet>
        <DrawerFooter className="p-0">
          {isAdopt ? (
            <Alert
              role="status"
              className="mb-2 border-amber-500/30 bg-amber-500/5 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
            >
              <HugeiconsIcon
                icon={Alert02Icon}
                className="text-amber-600 dark:text-amber-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              <AlertTitle>Catch up occurrences</AlertTitle>
              <AlertDescription className="text-amber-950/90 dark:text-amber-100/90">
                {laterDueCount === null
                  ? previewError
                    ? `Preview unavailable: ${previewError}`
                    : "Calculating later due occurrences…"
                  : laterDueCount === 0
                    ? "No later due occurrences will be created on confirm."
                    : `Confirming will catch up ${laterDueCount} later due occurrence${laterDueCount === 1 ? "" : "s"}.`}
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting || !open || (isAdopt && laterDueCount === null)}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? copy.submittingLabel : copy.submitLabel}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}
