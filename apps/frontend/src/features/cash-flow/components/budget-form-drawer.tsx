import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldLegend,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CommandError } from "@/commands/errors";

import { budgetMeasurementLabel, budgetRolloverOptionLabel } from "../lib/budget";
import { formatAmountFromMinor } from "../lib/transaction";
import {
  BUDGET_CADENCES,
  BUDGET_MEASUREMENT_MODES,
  BUDGET_ROLLOVER_MODES,
  budgetFormSchema,
  type Budget,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";
import type { TransactionCategory } from "../types/model";
import { BudgetCategoryScopeField } from "./budget-category-scope-field";

interface BudgetFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BudgetFormValues) => Promise<Result.Result<Budget, CommandError>>;
  categories: Array<TransactionCategory>;
  budget?: Budget;
  mode?: "create" | "edit";
}

const cadenceToggleLabel = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
} as const;

const rolloverToggleLabel = {
  off: "Off",
  previousPeriodOnly: "Previous",
  cumulative: "Cumulative",
} as const;

const getDefaultValues = (budget?: Budget): BudgetFormInput => ({
  name: budget?.name ?? "",
  baseAllowance: budget ? formatAmountFromMinor(budget.baseAllowance) : "",
  cadence: budget?.cadence ?? "month",
  categoryIds: budget?.categoryIds ?? [],
  measurementMode: budget?.measurementMode ?? "spending",
  rolloverMode: budget?.rolloverMode ?? "off",
  warningPercentage:
    budget?.warningPercentage === null ? "disabled" : String(budget?.warningPercentage ?? 80),
});

function BudgetFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  categories,
  budget,
  mode = "create",
}: BudgetFormDrawerProps) {
  const isEdit = mode === "edit";
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: getDefaultValues(isEdit ? budget : undefined),
  });
  const { reset } = form;
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) reset(getDefaultValues(isEdit ? budget : undefined));
  }, [budget, isEdit, open, reset]);

  const submit = async (values: BudgetFormValues) => {
    const result = await onSubmit(values);
    if (Result.isFailure(result)) {
      if (result.error.code === "nameConflict") {
        form.setError("name", { type: "server", message: result.error.message });
      } else {
        form.setError("root.server", {
          type: "server",
          message:
            result.error.code === "revisionConflict"
              ? "Budget changed elsewhere. Reload it before saving."
              : result.error.message,
        });
      }
      return;
    }

    toast.success(isEdit ? "Budget updated" : "Budget created");
    form.reset();
    onOpenChange(false);
  };

  return (
    <DrawerContent className="data-[swipe-axis=x]:w-full sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader>
        <DrawerTitle>{isEdit ? "Edit budget" : "New budget"}</DrawerTitle>
        <DrawerDescription>
          {isEdit
            ? "Update the current period configuration. Closed periods remain unchanged."
            : "Set an allowance, period, rules, and transaction scope."}
        </DrawerDescription>
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => void submit(values))}
      >
        <FieldGroup className="flex-1 overflow-y-auto p-4">
          <FieldSet>
            <FieldLegend>Basics</FieldLegend>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="budget-name">Name</FieldLabel>
                <Input
                  id="budget-name"
                  autoFocus
                  placeholder="Monthly spending"
                  aria-invalid={Boolean(errors.name)}
                  {...form.register("name")}
                />
                <FieldDescription>
                  Use a unique name you can recognize in the list.
                </FieldDescription>
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={Boolean(errors.baseAllowance)}>
                <FieldLabel htmlFor="budget-allowance">Allowance</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="budget-allowance"
                    type="text"
                    inputMode="decimal"
                    placeholder="1000.00"
                    aria-invalid={Boolean(errors.baseAllowance)}
                    {...form.register("baseAllowance")}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>EUR</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>Amount available in each budget period.</FieldDescription>
                <FieldError>{errors.baseAllowance?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel>Cadence</FieldLabel>
                <Controller
                  control={form.control}
                  name="cadence"
                  render={({ field }) => (
                    <ToggleGroup
                      aria-label="Budget cadence"
                      className="w-full"
                      disabled={isEdit}
                      spacing={0}
                      variant="outline"
                      value={field.value ? [field.value] : []}
                      onValueChange={(values) => {
                        const value = values.at(-1);
                        if (
                          value === "day" ||
                          value === "week" ||
                          value === "month" ||
                          value === "year"
                        ) {
                          field.onChange(value);
                        }
                      }}
                    >
                      {BUDGET_CADENCES.map((value) => (
                        <ToggleGroupItem key={value} value={value} className="flex-1">
                          {cadenceToggleLabel[value]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
                <FieldDescription>
                  {isEdit
                    ? "Cadence is fixed after creation."
                    : "Periods follow local calendar boundaries."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <FieldSet>
            <FieldLegend>Budget rules</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel>Measurement</FieldLabel>
                <Controller
                  control={form.control}
                  name="measurementMode"
                  render={({ field }) => (
                    <ToggleGroup
                      aria-label="Budget measurement"
                      className="w-full"
                      spacing={0}
                      variant="outline"
                      value={field.value ? [field.value] : []}
                      onValueChange={(values) => {
                        const value = values.at(-1);
                        if (value === "spending" || value === "netCashFlow") {
                          field.onChange(value);
                        }
                      }}
                    >
                      {BUDGET_MEASUREMENT_MODES.map((value) => (
                        <ToggleGroupItem key={value} value={value} className="flex-1">
                          {budgetMeasurementLabel[value]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
                <FieldDescription>
                  Net cash flow subtracts matching income from spending.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Rollover</FieldLabel>
                <Controller
                  control={form.control}
                  name="rolloverMode"
                  render={({ field }) => (
                    <ToggleGroup
                      aria-label="Budget rollover"
                      className="w-full"
                      spacing={0}
                      variant="outline"
                      value={field.value ? [field.value] : []}
                      onValueChange={(values) => {
                        const value = values.at(-1);
                        if (
                          value === "off" ||
                          value === "previousPeriodOnly" ||
                          value === "cumulative"
                        ) {
                          field.onChange(value);
                        }
                      }}
                    >
                      {BUDGET_ROLLOVER_MODES.map((value) => (
                        <ToggleGroupItem
                          key={value}
                          value={value}
                          className="min-w-0 flex-1 px-1"
                          title={budgetRolloverOptionLabel[value]}
                        >
                          {rolloverToggleLabel[value]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
                <FieldDescription>
                  Carry unused allowance or overspending into later periods.
                </FieldDescription>
              </Field>
              <Field data-invalid={Boolean(errors.warningPercentage)}>
                <FieldLabel>Warning</FieldLabel>
                <Controller
                  control={form.control}
                  name="warningPercentage"
                  render={({ field }) => {
                    const enabled = field.value !== "disabled";
                    return (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="budget-warning-enabled"
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true ? "80" : "disabled")
                          }
                        />
                        <FieldLabel
                          htmlFor="budget-warning-enabled"
                          className="shrink-0 font-normal"
                        >
                          Warn me at
                        </FieldLabel>
                        <InputGroup className="w-24">
                          <InputGroupInput
                            id="budget-warning"
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            disabled={!enabled}
                            value={enabled ? field.value : ""}
                            onBlur={field.onBlur}
                            onChange={(event) => field.onChange(event.target.value)}
                            name={field.name}
                            ref={field.ref}
                            aria-label="Warning threshold"
                            aria-invalid={Boolean(errors.warningPercentage)}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>%</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </div>
                    );
                  }}
                />
                <FieldDescription>
                  Disable this when you do not want an early spending warning.
                </FieldDescription>
                <FieldError errors={[errors.warningPercentage]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <BudgetCategoryScopeField categories={categories} control={form.control} />
        </FieldGroup>

        <FieldError className="px-4" errors={[errors.root?.server]} />
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? "Saving budget..."
                : "Creating budget..."
              : isEdit
                ? "Save budget"
                : "Create budget"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { BudgetFormDrawer };
