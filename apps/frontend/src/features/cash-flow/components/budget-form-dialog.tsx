import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CommandError } from "@/commands/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  BUDGET_CADENCES,
  BUDGET_MEASUREMENT_MODES,
  budgetFormSchema,
  type Budget,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";
import type { TransactionCategory } from "../types/model";
import { budgetCadenceLabel, budgetMeasurementOptionLabel } from "../lib/budget";

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BudgetFormValues) => Promise<Result.Result<Budget, CommandError>>;
  categories: Array<TransactionCategory>;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  onSubmit,
  categories,
}: BudgetFormDialogProps) {
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      baseAllowance: "",
      cadence: "month",
      categoryIds: [],
      measurementMode: "spending",
      warningPercentage: "80",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = async (values: BudgetFormValues) => {
    const result = await onSubmit(values);
    if (Result.isFailure(result)) {
      if (result.error.code === "nameConflict") {
        form.setError("name", { type: "server", message: result.error.message });
      } else {
        form.setError("root.server", { type: "server", message: result.error.message });
      }
      return;
    }

    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Choose period, scope, and measurement. Empty scope tracks all transactions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => void submit(values))}>
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
                Required. Names are unique without regard to casing.
              </FieldDescription>
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.baseAllowance)}>
              <FieldLabel htmlFor="budget-allowance">Monthly allowance</FieldLabel>
              <Input
                id="budget-allowance"
                type="text"
                inputMode="decimal"
                placeholder="1000.00"
                aria-invalid={Boolean(errors.baseAllowance)}
                {...form.register("baseAllowance")}
              />
              <FieldDescription>
                Amount in EUR. Spending mode and an 80% warning are enabled by default.
              </FieldDescription>
              <FieldError>{errors.baseAllowance?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.warningPercentage)}>
              <FieldLabel htmlFor="budget-warning">Warning threshold (%)</FieldLabel>
              <Controller
                control={form.control}
                name="warningPercentage"
                render={({ field }) => {
                  const isDisabled = field.value === "disabled";
                  return (
                    <div className="flex items-center gap-2">
                      <Input
                        id="budget-warning"
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        disabled={isDisabled}
                        value={isDisabled ? "" : field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        aria-invalid={Boolean(errors.warningPercentage)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          aria-label="Disable budget warning"
                          checked={isDisabled}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true ? "disabled" : "80")
                          }
                        />
                        Disable
                      </label>
                    </div>
                  );
                }}
              />
              <FieldDescription>
                Warn when spending reaches this percentage of allowance.
              </FieldDescription>
              <FieldError errors={[errors.warningPercentage]} />
            </Field>
            <Field>
              <FieldLabel>Cadence</FieldLabel>
              <Controller
                control={form.control}
                name="cadence"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className="w-full" aria-label="Budget cadence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {BUDGET_CADENCES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {budgetCadenceLabel[value]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>Periods use local calendar boundaries.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Measurement</FieldLabel>
              <Controller
                control={form.control}
                name="measurementMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className="w-full" aria-label="Budget measurement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {BUDGET_MEASUREMENT_MODES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {budgetMeasurementOptionLabel[value]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                Income reduces spending only when it matches the rules.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Categories</FieldLabel>
              <Controller
                control={form.control}
                name="categoryIds"
                render={({ field }) => {
                  const selectedIds = field.value ?? [];
                  return (
                    <div className="flex max-h-36 flex-col gap-2 overflow-y-auto border p-2">
                      {categories.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No categories yet</span>
                      ) : (
                        categories.map((category) => (
                          <label key={category.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedIds.includes(category.id)}
                              onCheckedChange={(checked) => {
                                field.onChange(
                                  checked === true
                                    ? [...selectedIds, category.id]
                                    : selectedIds.filter((id) => id !== category.id),
                                );
                              }}
                            />
                            <span>
                              {category.parent ? `${category.parent.name} / ` : ""}
                              {category.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  );
                }}
              />
              <FieldDescription>Selecting a root includes its subcategories.</FieldDescription>
            </Field>
          </FieldGroup>
          <FieldError className="mt-3" errors={[errors.root?.server]} />
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
