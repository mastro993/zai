import { type Control, Controller, type FieldErrors } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { budgetMeasurementLabel, budgetRolloverOptionLabel } from "../lib/budget";
import {
  BUDGET_MEASUREMENT_MODES,
  BUDGET_ROLLOVER_MODES,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";

interface BudgetFormRulesFieldsProps {
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
  errors: FieldErrors<BudgetFormInput>;
}

function BudgetFormRulesFields({ control, errors }: BudgetFormRulesFieldsProps) {
  const warningErrorId = "budget-warning-error";

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Measurement</FieldLabel>
        <Controller
          control={control}
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
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-auto min-h-8 min-w-0 flex-1 whitespace-normal px-1.5 py-1.5 leading-tight"
                >
                  {budgetMeasurementLabel[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        <FieldDescription>Net cash flow subtracts matching income from spending.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Rollover</FieldLabel>
        <Controller
          control={control}
          name="rolloverMode"
          render={({ field }) => (
            <ToggleGroup
              aria-label="Budget rollover"
              className="w-full"
              orientation="vertical"
              spacing={0}
              variant="outline"
              value={field.value ? [field.value] : []}
              onValueChange={(values) => {
                const value = values.at(-1);
                if (value === "off" || value === "previousPeriodOnly" || value === "cumulative") {
                  field.onChange(value);
                }
              }}
            >
              {BUDGET_ROLLOVER_MODES.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-auto min-h-8 w-full justify-start px-2.5 py-1.5"
                >
                  {budgetRolloverOptionLabel[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        <FieldDescription>Carry unused allowance or overspend into later periods.</FieldDescription>
      </Field>
      <Field data-invalid={Boolean(errors.warningPercentage)}>
        <FieldLabel>Warning threshold</FieldLabel>
        <Controller
          control={control}
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
                <FieldLabel htmlFor="budget-warning-enabled" className="shrink-0 font-normal">
                  Warn at
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
                    aria-label="Warning percentage"
                    aria-invalid={Boolean(errors.warningPercentage)}
                    aria-describedby={errors.warningPercentage ? warningErrorId : undefined}
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
          Alert when spending reaches this percent of the allowance.
        </FieldDescription>
        <FieldError id={warningErrorId} errors={[errors.warningPercentage]} />
      </Field>
    </FieldGroup>
  );
}

export { BudgetFormRulesFields };
