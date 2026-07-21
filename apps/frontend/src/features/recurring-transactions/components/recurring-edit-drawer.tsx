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
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
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

import { defaultFirstScheduledLocal } from "../lib/recurring";
import {
  SCHEDULE_INTERVAL_UNITS,
  recurringEditFormSchema,
  type RecurringEditFormInput,
  type RecurringEditFormValues,
  type RecurringMutationOutcome,
  type RecurringTransactionDocument,
} from "../types/recurring-transaction";

export type RecurringEditSection = RecurringEditFormValues["section"];

interface RecurringEditDrawerProps {
  open: boolean;
  section: RecurringEditSection;
  document: RecurringTransactionDocument;
  categories: Array<TransactionCategory>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: RecurringEditFormValues,
  ) => Promise<Result.Result<RecurringMutationOutcome, CommandError>>;
}

const toLocalInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return defaultFirstScheduledLocal();
  }
  return value.length >= 16 ? value.slice(0, 16) : value;
};

const defaultsFromDocument = (
  document: RecurringTransactionDocument,
  section: RecurringEditSection,
): RecurringEditFormInput => {
  const { recurringTransaction, schedule, template } = document;
  const scheduleKind = schedule.rule.type === "monthlyDay" ? "monthlyDay" : "interval";
  return {
    section,
    name: recurringTransaction.name,
    scheduleKind,
    intervalEvery: schedule.rule.type === "interval" ? String(schedule.rule.every) : "1",
    intervalUnit: schedule.rule.type === "interval" ? schedule.rule.unit : "month",
    monthlyDay: schedule.rule.type === "monthlyDay" ? String(schedule.rule.day) : "1",
    nextScheduledLocal: toLocalInputValue(
      document.occurrenceSummary.nextScheduledLocal ?? schedule.firstScheduledLocal,
    ),
    totalMode: recurringTransaction.totalOccurrences == null ? "indefinite" : "finite",
    totalOccurrences:
      recurringTransaction.totalOccurrences == null
        ? ""
        : String(recurringTransaction.totalOccurrences),
    description: template.description ?? "",
    amount: (template.amount / 100).toFixed(2),
    transactionType: template.transactionType,
    transactionCategoryId: template.transactionCategoryId ?? undefined,
    notes: template.notes ?? "",
  };
};

const sectionTitle: Record<RecurringEditSection, string> = {
  name: "Rename",
  schedule: "Edit schedule",
  template: "Edit template",
  count: "Edit count",
};

export function RecurringEditDrawer({
  open,
  section,
  document,
  categories,
  onOpenChange,
  onSubmit,
}: RecurringEditDrawerProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringEditFormInput, unknown, RecurringEditFormValues>({
    resolver: zodResolver(recurringEditFormSchema),
    values: defaultsFromDocument(document, section),
  });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const totalMode = useWatch({ control, name: "totalMode" });

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit({ ...values, section });
    if (Result.isFailure(result)) {
      toast.error(
        result.error.code === "revisionConflict"
          ? "Recurring transaction changed elsewhere. Reload before editing again."
          : result.error.message,
      );
      return;
    }
    if (result.value.outcome === "unchanged") {
      toast.message(
        result.value.reason === "same_value"
          ? "No changes to apply."
          : result.value.reason === "generation_blocked"
            ? "Repair the generation failure before editing this field."
            : "This field cannot be edited in the current state.",
      );
    } else {
      toast.success("Recurring transaction updated");
    }
    onOpenChange(false);
    reset(defaultsFromDocument(result.value.document, section));
  });

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{sectionTitle[section]}</DrawerTitle>
        <DrawerDescription>
          Future occurrences update from this edit. Fulfilled history stays unchanged.
        </DrawerDescription>
      </DrawerHeader>
      <form className="flex flex-col gap-4 px-4 pb-4" onSubmit={submit} noValidate>
        <FieldSet>
          <FieldGroup>
            {section === "name" ? (
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="recurring-edit-name">Name</FieldLabel>
                <Input id="recurring-edit-name" aria-required="true" {...register("name")} />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>
            ) : null}

            {section === "schedule" ? (
              <>
                <Field>
                  <FieldLabel>Schedule kind</FieldLabel>
                  <Controller
                    control={control}
                    name="scheduleKind"
                    render={({ field }) => (
                      <ToggleGroup
                        value={[field.value]}
                        onValueChange={(value) => {
                          const next = value[0];
                          if (next === "interval" || next === "monthlyDay") {
                            field.onChange(next);
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.intervalEvery)}>
                      <FieldLabel htmlFor="recurring-edit-every">Every</FieldLabel>
                      <Input id="recurring-edit-every" {...register("intervalEvery")} />
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
                            value={[field.value ?? "month"]}
                            onValueChange={(value) => {
                              const next = value[0];
                              if (
                                next === "day" ||
                                next === "week" ||
                                next === "month" ||
                                next === "year"
                              ) {
                                field.onChange(next);
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
                    <FieldLabel htmlFor="recurring-edit-day">Day of month</FieldLabel>
                    <Input id="recurring-edit-day" {...register("monthlyDay")} />
                    <FieldError>{errors.monthlyDay?.message}</FieldError>
                  </Field>
                )}
                <Field data-invalid={Boolean(errors.nextScheduledLocal)}>
                  <FieldLabel htmlFor="recurring-edit-next">Next occurrence</FieldLabel>
                  <Input
                    id="recurring-edit-next"
                    type="datetime-local"
                    aria-required="true"
                    {...register("nextScheduledLocal")}
                  />
                  <FieldError>{errors.nextScheduledLocal?.message}</FieldError>
                </Field>
              </>
            ) : null}

            {section === "template" ? (
              <>
                <Field data-invalid={Boolean(errors.amount)}>
                  <FieldLabel htmlFor="recurring-edit-amount">Amount</FieldLabel>
                  <InputGroup>
                    <InputGroupInput id="recurring-edit-amount" {...register("amount")} />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>EUR</InputGroupText>
                    </InputGroupAddon>
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
                        value={[field.value ?? "expense"]}
                        onValueChange={(value) => {
                          const next = value[0];
                          if (next === "expense" || next === "income") {
                            field.onChange(next);
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
                  <FieldLabel htmlFor="recurring-edit-description">Description</FieldLabel>
                  <Input id="recurring-edit-description" {...register("description")} />
                </Field>
                <Controller
                  control={control}
                  name="transactionCategoryId"
                  render={({ field }) => (
                    <CategoryDrawerSelect
                      id="recurring-edit-category"
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
                <Field>
                  <FieldLabel htmlFor="recurring-edit-notes">Notes</FieldLabel>
                  <Input id="recurring-edit-notes" {...register("notes")} />
                </Field>
              </>
            ) : null}

            {section === "count" ? (
              <>
                <Field>
                  <FieldLabel>Count mode</FieldLabel>
                  <Controller
                    control={control}
                    name="totalMode"
                    render={({ field }) => (
                      <ToggleGroup
                        variant="outline"
                        value={[field.value ?? "indefinite"]}
                        onValueChange={(value) => {
                          const next = value[0];
                          if (next === "indefinite" || next === "finite") {
                            field.onChange(next);
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
                    <FieldLabel htmlFor="recurring-edit-total">Total occurrences</FieldLabel>
                    <Input id="recurring-edit-total" {...register("totalOccurrences")} />
                    <FieldError>{errors.totalOccurrences?.message}</FieldError>
                  </Field>
                ) : null}
              </>
            ) : null}
          </FieldGroup>
        </FieldSet>
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            Save
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" />}>Cancel</DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}
