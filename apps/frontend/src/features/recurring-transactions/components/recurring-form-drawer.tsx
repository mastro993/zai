import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown01Icon, ArrowUp01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { format, parseISO } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
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
import {
  combineDateTime,
  isPartialAmountInput,
  normalizeAmountInput,
  splitDateTime,
} from "@/features/transactions/lib/transaction";

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
  ) => Promise<Result.Result<RecurringCreateOutcome | RecurringMutationOutcome, CommandError>>;
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
  const configLocked = isEdit && !configurationEditable;
  const descriptionLocked = isEdit && !descriptionEditable;
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
  const totalMode = useWatch({ control, name: "totalMode" });
  const amountErrorId = "recurring-amount-error";
  const dateErrorId = "recurring-first-error";
  const scheduleErrorId = "recurring-schedule-error";
  const typeErrorId = "recurring-type-error";
  const intervalUnitItems = getScheduleIntervalUnitItems(intervalEvery);

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
                    disabled={configLocked}
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
                      readOnly={configLocked}
                      aria-describedby={errors.amount ? amountErrorId : undefined}
                      aria-invalid={Boolean(errors.amount)}
                      value={field.value ?? ""}
                      onBlur={(event) => {
                        field.onBlur();
                        const normalized = normalizeAmountInput(event.target.value);

                        if (normalized !== event.target.value) {
                          field.onChange(normalized);
                        }
                      }}
                      name={field.name}
                      ref={field.ref}
                      onChange={(event) => {
                        const nextValue = event.target.value;

                        if (isPartialAmountInput(nextValue)) {
                          field.onChange(nextValue);
                        }
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>EUR</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                )}
              />
              <FieldError id={amountErrorId}>{errors.amount?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel
                htmlFor={configLocked ? "recurring-category-locked" : "recurring-category-trigger"}
              >
                Category
              </FieldLabel>
              {configLocked ? (
                <Input
                  id="recurring-category-locked"
                  readOnly
                  value={
                    categories.find(
                      (category) =>
                        category.id ===
                        (mode.type === "edit"
                          ? mode.document.template.transactionCategoryId
                          : undefined),
                    )?.name ?? "Uncategorized"
                  }
                />
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
                readOnly={descriptionLocked}
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
              />
              <FieldError>{errors.description?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-notes">Notes</FieldLabel>
              <Textarea
                id="recurring-notes"
                placeholder="Optional details for your own reference"
                className="min-h-16 resize-y"
                readOnly={configLocked}
                {...register("notes")}
              />
            </Field>

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
                              disabled={configLocked}
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
                      <Input
                        id="recurring-first-time"
                        type="time"
                        className="w-28 shrink-0 bg-background"
                        aria-invalid={Boolean(errors.firstScheduledLocal)}
                        value={time}
                        readOnly={configLocked}
                        onChange={(event) => {
                          field.onChange(combineDateTime(date, event.target.value));
                        }}
                      />
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
                          <SelectTrigger aria-label="Monthly day" disabled={configLocked}>
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

            <Field>
              <FieldLabel>Total</FieldLabel>
              <Controller
                control={control}
                name="totalMode"
                render={({ field }) => (
                  <ToggleGroup
                    variant="outline"
                    disabled={configLocked}
                    value={[field.value ?? "indefinite"]}
                    onValueChange={(value) => {
                      if (value[0]) {
                        field.onChange(value[0]);
                      }
                    }}
                  >
                    <ToggleGroupItem value="indefinite">Indefinite</ToggleGroupItem>
                    <ToggleGroupItem value="finite">Finite</ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </Field>
            {totalMode === "finite" ? (
              <Field data-invalid={Boolean(errors.totalOccurrences)}>
                <FieldLabel htmlFor="recurring-total">Number of occurrences</FieldLabel>
                <Input
                  id="recurring-total"
                  inputMode="numeric"
                  readOnly={configLocked}
                  {...register("totalOccurrences")}
                />
                <FieldError>{errors.totalOccurrences?.message}</FieldError>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting || !open} aria-busy={isSubmitting}>
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
