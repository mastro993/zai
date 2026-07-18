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

import { formatAmountFromMinor } from "@/features/transactions/lib/transaction";
import {
  BUDGET_CADENCES,
  budgetFormSchema,
  type Budget,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";
import type { TransactionCategory } from "@/features/categories/types/model";
import { BudgetFormRulesFields } from "./budget-form-rules-fields";
import { CategoryDrawerSelect } from "@/features/categories/components/category-drawer-select";

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
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: getDefaultValues(isEdit ? budget : undefined),
  });
  const { reset } = form;
  const { errors, isSubmitting } = form.formState;
  const nameErrorId = "budget-name-error";
  const allowanceErrorId = "budget-allowance-error";
  const warningErrorId = "budget-warning-error";
  const cadenceDescriptionId = "budget-cadence-description";
  const serverErrorId = "budget-server-error";

  useEffect(() => {
    if (!open) {
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
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
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
                  <FieldError id={allowanceErrorId}>{errors.baseAllowance?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.warningPercentage)}>
                  <FieldLabel htmlFor="budget-warning">Warn at</FieldLabel>
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
                            aria-label="Warn at"
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true ? "80" : "disabled")
                            }
                          />
                          <InputGroup className="w-20">
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
                              aria-label="Warning percentage"
                              aria-invalid={Boolean(errors.warningPercentage)}
                              aria-describedby={
                                errors.warningPercentage ? warningErrorId : undefined
                              }
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupText>%</InputGroupText>
                            </InputGroupAddon>
                          </InputGroup>
                        </div>
                      );
                    }}
                  />
                  <FieldError id={warningErrorId} errors={[errors.warningPercentage]} />
                </Field>
              </div>
              <Field data-invalid={Boolean(errors.categoryIds)} className="min-w-0">
                <FieldLabel htmlFor="budget-categories-trigger">Categories</FieldLabel>
                <Controller
                  control={form.control}
                  name="categoryIds"
                  render={({ field }) => {
                    const selectedIds = field.value ?? [];
                    return (
                      <CategoryDrawerSelect
                        id="budget-categories-trigger"
                        mode="multiple"
                        categories={categories}
                        value={selectedIds}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        parentOpen={open}
                        placeholder="All categories"
                        ariaLabel={
                          selectedIds.length === 0
                            ? "Choose categories, all categories"
                            : `Choose categories, ${selectedIds.length} selected`
                        }
                        drawerTitle="Select categories"
                        drawerDescription="Only selected categories count toward this budget."
                        backAriaLabel="Back to budget"
                        emptyListMessage="No categories yet. This budget will include all transactions."
                      />
                    );
                  }}
                />
                <FieldDescription>
                  Empty includes all transactions. Roots include their subcategories.
                </FieldDescription>
                <FieldError errors={[errors.categoryIds]} />
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

          <FieldSet>
            <FieldLegend>Advanced rules</FieldLegend>
            <BudgetFormRulesFields control={form.control} formOpen={open} />
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
