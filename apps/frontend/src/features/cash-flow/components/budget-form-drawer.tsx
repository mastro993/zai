import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
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
  budgetFormSchema,
  type Budget,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";
import type { TransactionCategory } from "../types/model";
import { BudgetCategoryScopeField } from "./budget-category-scope-field";
import { BudgetFormRulesDrawer } from "./budget-form-rules-drawer";

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

const getDefaultValues = (budget?: Budget): BudgetFormInput => ({
  name: budget?.name ?? "",
  baseAllowance: budget ? formatAmountFromMinor(budget.baseAllowance) : "",
  cadence: budget?.cadence ?? "month",
  categoryScope: budget && budget.categoryIds.length > 0 ? "specific" : "all",
  categoryIds: budget?.categoryIds ?? [],
  measurementMode: budget?.measurementMode ?? "spending",
  rolloverMode: budget?.rolloverMode ?? "off",
  warningPercentage:
    budget?.warningPercentage === null ? "disabled" : String(budget?.warningPercentage ?? 80),
});

const getFormCopy = (isEdit: boolean) =>
  isEdit
    ? {
        title: "Edit budget",
        description: "Update the current period configuration. Closed periods stay unchanged.",
        submit: "Save budget",
        submitting: "Saving...",
      }
    : {
        title: "New budget",
        description: "Set allowance, period, and which categories count.",
        submit: "Create budget",
        submitting: "Creating...",
      };

function rulesSummary(
  measurementMode: BudgetFormInput["measurementMode"],
  rolloverMode: BudgetFormInput["rolloverMode"],
  warningPercentage: BudgetFormInput["warningPercentage"],
) {
  const warning =
    warningPercentage === "disabled" || warningPercentage === ""
      ? "No warning"
      : `Warn at ${warningPercentage}%`;
  return `${budgetMeasurementLabel[measurementMode ?? "spending"]} · ${budgetRolloverOptionLabel[rolloverMode ?? "off"]} · ${warning}`;
}

function BudgetFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  categories,
  budget,
  mode = "create",
}: BudgetFormDrawerProps) {
  const isEdit = mode === "edit";
  const { title, description, submit: submitLabel, submitting } = getFormCopy(isEdit);
  const [rulesOpen, setRulesOpen] = useState(false);
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: getDefaultValues(isEdit ? budget : undefined),
  });
  const { reset } = form;
  const { errors, isSubmitting } = form.formState;
  const measurementMode = useWatch({ control: form.control, name: "measurementMode" });
  const rolloverMode = useWatch({ control: form.control, name: "rolloverMode" });
  const warningPercentage = useWatch({ control: form.control, name: "warningPercentage" });
  const nameErrorId = "budget-name-error";
  const allowanceErrorId = "budget-allowance-error";
  const cadenceDescriptionId = "budget-cadence-description";
  const serverErrorId = "budget-server-error";
  const rulesSummaryId = "budget-rules-summary";

  useEffect(() => {
    if (!open) {
      setRulesOpen(false);
      return;
    }
    reset(getDefaultValues(isEdit ? budget : undefined));
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
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
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
                  aria-describedby={errors.name ? nameErrorId : undefined}
                  {...form.register("name")}
                />
                <FieldDescription>Must be unique among your budgets.</FieldDescription>
                <FieldError id={nameErrorId} errors={[errors.name]} />
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
                    aria-describedby={errors.baseAllowance ? allowanceErrorId : undefined}
                    {...form.register("baseAllowance")}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>EUR</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>Amount available each period.</FieldDescription>
                <FieldError id={allowanceErrorId}>{errors.baseAllowance?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel>Cadence</FieldLabel>
                <Controller
                  control={form.control}
                  name="cadence"
                  render={({ field }) => (
                    <ToggleGroup
                      aria-label="Budget cadence"
                      aria-describedby={cadenceDescriptionId}
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
                <FieldDescription id={cadenceDescriptionId}>
                  {isEdit
                    ? "Cadence is fixed after creation."
                    : "Periods follow local calendar boundaries."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <BudgetCategoryScopeField
            categories={categories}
            control={form.control}
            formOpen={open}
            error={errors.categoryIds}
          />

          <FieldSeparator />

          <FieldSet>
            <FieldLegend>Advanced rules</FieldLegend>
            <Field>
              <Drawer open={rulesOpen} onOpenChange={setRulesOpen} swipeDirection="right">
                <DrawerTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
                      aria-label="Advanced rules"
                      aria-describedby={rulesSummaryId}
                    />
                  }
                >
                  <span
                    id={rulesSummaryId}
                    className="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground"
                  >
                    {rulesSummary(measurementMode, rolloverMode, warningPercentage)}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="shrink-0"
                    data-icon="inline-end"
                    aria-hidden="true"
                  />
                </DrawerTrigger>
                <BudgetFormRulesDrawer control={form.control} errors={errors} />
              </Drawer>
            </Field>
          </FieldSet>
        </FieldGroup>

        <FieldError id={serverErrorId} className="px-4" errors={[errors.root?.server]} />
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? submitting : submitLabel}
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
