import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
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
import { formatAmountFromMinor } from "@/features/transactions/lib/transaction";
import type { Transaction } from "@/features/transactions/types/model";

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

const defaultsFromTransaction = (transaction: Transaction): AdoptRecurringFormInput => ({
  scheduleKind: "interval",
  intervalEvery: "1",
  intervalUnit: "month",
  monthlyDay: "1",
  totalMode: "indefinite",
  totalOccurrences: "",
  description: transaction.description?.trim() || "Recurring transaction",
  amount: formatAmountFromMinor(transaction.amount),
  transactionType: transaction.transactionType === "income" ? "income" : "expense",
  transactionCategoryId: transaction.transactionCategoryId ?? undefined,
  notes: transaction.notes ?? "",
});

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
    defaultValues: defaultsFromTransaction(transaction),
  });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const totalMode = useWatch({ control, name: "totalMode" });
  const intervalEvery = useWatch({ control, name: "intervalEvery" });
  const intervalUnit = useWatch({ control, name: "intervalUnit" });
  const monthlyDay = useWatch({ control, name: "monthlyDay" });
  const totalOccurrences = useWatch({ control, name: "totalOccurrences" });
  const [laterDueCount, setLaterDueCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string>();

  useEffect(() => {
    reset(defaultsFromTransaction(transaction));
  }, [reset, transaction]);

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
      description: "preview",
      amount: 0,
      transactionType: "expense",
      transactionCategoryId: undefined,
      notes: "",
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
          Keep this transaction as occurrence one. Future template starts from its details. Catch-up
          count shows before you confirm.
        </DrawerDescription>
      </DrawerHeader>
      <form className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4" onSubmit={submit}>
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
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel>Schedule</FieldLabel>
              <Controller
                control={control}
                name="scheduleKind"
                render={({ field }) => (
                  <ToggleGroup
                    variant="outline"
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
                  <FieldLabel htmlFor="adopt-recurring-every">Every</FieldLabel>
                  <Input
                    id="adopt-recurring-every"
                    inputMode="numeric"
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
              <FieldLabel>Total</FieldLabel>
              <Controller
                control={control}
                name="totalMode"
                render={({ field }) => (
                  <ToggleGroup
                    variant="outline"
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
                <FieldLabel htmlFor="adopt-recurring-total">Number of occurrences</FieldLabel>
                <Input
                  id="adopt-recurring-total"
                  inputMode="numeric"
                  {...register("totalOccurrences")}
                />
                <FieldError>{errors.totalOccurrences?.message}</FieldError>
              </Field>
            ) : null}

            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="adopt-recurring-amount">Future amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>€</InputGroupText>
                </InputGroupAddon>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <InputGroupInput
                      id="adopt-recurring-amount"
                      inputMode="decimal"
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

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="adopt-recurring-description">Description</FieldLabel>
              <Input
                id="adopt-recurring-description"
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
              />
              <FieldError>{errors.description?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Controller
                control={control}
                name="transactionCategoryId"
                render={({ field }) => (
                  <CategoryDrawerSelect
                    id="adopt-recurring-category"
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
            </Field>

            <Field>
              <FieldLabel htmlFor="adopt-recurring-notes">Notes</FieldLabel>
              <Input id="adopt-recurring-notes" {...register("notes")} />
            </Field>
          </FieldGroup>
        </FieldSet>
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting || !open || laterDueCount === null}>
            {isSubmitting ? "Adopting..." : "Confirm adoption"}
          </Button>
          <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}
