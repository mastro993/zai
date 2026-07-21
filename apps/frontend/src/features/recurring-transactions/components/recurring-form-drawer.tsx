import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CommandError } from "@/commands/errors";
import { CategoryDrawerSelect } from "@/features/categories/components/category-drawer-select";
import type { TransactionCategory } from "@/features/categories/types/model";

import {
  createRecurringFormDefaults,
  getRecurringFormCopy,
  getRecurringFormDefaults,
} from "../lib/recurring-form";
import type { RecurringFormMode } from "../types/recurring-form-mode";
import {
  SCHEDULE_INTERVAL_UNITS,
  recurringFormSchema,
  type RecurringCreateOutcome,
  type RecurringFormInput,
  type RecurringFormValues,
  type RecurringMutationOutcome,
} from "../types/recurring-transaction";

interface RecurringFormDrawerProps {
  mode: RecurringFormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: RecurringFormValues,
  ) => Promise<Result.Result<RecurringCreateOutcome | RecurringMutationOutcome, CommandError>>;
  categories: Array<TransactionCategory>;
  configurationEditable?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function RecurringFormDrawer({
  mode,
  open,
  onOpenChange,
  onSubmit,
  categories,
  configurationEditable = true,
  returnFocusRef,
}: RecurringFormDrawerProps) {
  const copy = getRecurringFormCopy(mode);
  const isEdit = mode.type === "edit";
  const configLocked = isEdit && !configurationEditable;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormInput, unknown, RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    values: getRecurringFormDefaults(mode),
  });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const totalMode = useWatch({ control, name: "totalMode" });

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
    queueMicrotask(() => returnFocusRef?.current?.focus());
  });

  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader>
        <DrawerTitle>{copy.title}</DrawerTitle>
        <DrawerDescription>{copy.description}</DrawerDescription>
      </DrawerHeader>
      <form className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4" onSubmit={submit}>
        <FieldSet>
          <FieldGroup>
            {configLocked ? (
              <FieldDescription>
                Schedule, template, and count are locked while this source is stopped, completed, or
                needs attention. Name can still be updated.
              </FieldDescription>
            ) : null}

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="recurring-name">Name</FieldLabel>
              <Input
                id="recurring-name"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Schedule</FieldLabel>
              <Controller
                control={control}
                name="scheduleKind"
                render={({ field }) => (
                  <ToggleGroup
                    variant="outline"
                    disabled={configLocked}
                    value={[field.value]}
                    onValueChange={(value) => {
                      if (value[0]) {
                        field.onChange(value[0]);
                      }
                    }}
                  >
                    <ToggleGroupItem value="interval">Interval</ToggleGroupItem>
                    <ToggleGroupItem value="monthlyDay">Monthly day</ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </Field>

            {scheduleKind === "interval" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errors.intervalEvery)}>
                  <FieldLabel htmlFor="recurring-every">Every</FieldLabel>
                  <Input
                    id="recurring-every"
                    inputMode="numeric"
                    readOnly={configLocked}
                    {...register("intervalEvery")}
                  />
                  <FieldError>{errors.intervalEvery?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Unit</FieldLabel>
                  <Controller
                    control={control}
                    name="intervalUnit"
                    render={({ field }) => (
                      <ToggleGroup
                        variant="outline"
                        disabled={configLocked}
                        value={[field.value ?? "month"]}
                        onValueChange={(value) => {
                          if (value[0]) {
                            field.onChange(value[0]);
                          }
                        }}
                      >
                        {SCHEDULE_INTERVAL_UNITS.map((unit) => (
                          <ToggleGroupItem key={unit} value={unit}>
                            {unit}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                </Field>
              </div>
            ) : (
              <Field data-invalid={Boolean(errors.monthlyDay)}>
                <FieldLabel htmlFor="recurring-monthly-day">Day of month</FieldLabel>
                <Input
                  id="recurring-monthly-day"
                  inputMode="numeric"
                  readOnly={configLocked}
                  {...register("monthlyDay")}
                />
                <FieldError>{errors.monthlyDay?.message}</FieldError>
              </Field>
            )}

            <Field data-invalid={Boolean(errors.firstScheduledLocal)}>
              <FieldLabel htmlFor="recurring-first">
                {isEdit ? "Next occurrence" : "First occurrence"}
              </FieldLabel>
              <Input
                id="recurring-first"
                type="datetime-local"
                readOnly={configLocked}
                aria-invalid={Boolean(errors.firstScheduledLocal)}
                {...register("firstScheduledLocal")}
              />
              <FieldError>{errors.firstScheduledLocal?.message}</FieldError>
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

            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="recurring-amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>€</InputGroupText>
                </InputGroupAddon>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <InputGroupInput
                      id="recurring-amount"
                      inputMode="decimal"
                      readOnly={configLocked}
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.amount)}
                    />
                  )}
                />
              </InputGroup>
              <FieldError>{errors.amount?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Controller
                control={control}
                name="transactionType"
                render={({ field }) => (
                  <ToggleGroup
                    variant="outline"
                    disabled={configLocked}
                    value={[field.value ?? "expense"]}
                    onValueChange={(value) => {
                      if (value[0]) {
                        field.onChange(value[0]);
                      }
                    }}
                  >
                    <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
                    <ToggleGroupItem value="income">Income</ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-description">Description</FieldLabel>
              <Input
                id="recurring-description"
                readOnly={configLocked}
                {...register("description")}
              />
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
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
                    <CategoryDrawerSelect
                      id="recurring-category"
                      mode="single"
                      categories={categories}
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                      placeholder="Uncategorized"
                      ariaLabel="Transaction category"
                      drawerTitle="Choose category"
                      clearable
                      parentOpen={open}
                    />
                  )}
                />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-notes">Notes</FieldLabel>
              <Input id="recurring-notes" readOnly={configLocked} {...register("notes")} />
            </Field>
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
