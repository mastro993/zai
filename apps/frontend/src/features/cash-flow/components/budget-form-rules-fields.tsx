import { type Control, Controller } from "react-hook-form";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  budgetMeasurementDescription,
  budgetMeasurementLabel,
  budgetRolloverDescription,
  budgetRolloverOptionLabel,
} from "../lib/budget";
import {
  BUDGET_MEASUREMENT_MODES,
  BUDGET_ROLLOVER_MODES,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget";

interface BudgetFormRulesFieldsProps {
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
}

function BudgetFormRulesFields({ control }: BudgetFormRulesFieldsProps) {
  const measurementDescriptionId = "budget-measurement-description";
  const rolloverDescriptionId = "budget-rollover-description";

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="budget-measurement">Measurement</FieldLabel>
        <Controller
          control={control}
          name="measurementMode"
          render={({ field }) => {
            const value = field.value ?? "spending";
            return (
              <>
                <Select
                  items={BUDGET_MEASUREMENT_MODES.map((mode) => ({
                    label: budgetMeasurementLabel[mode],
                    value: mode,
                  }))}
                  value={value}
                  onValueChange={(next) => {
                    if (next === "spending" || next === "netCashFlow") {
                      field.onChange(next);
                    }
                  }}
                >
                  <SelectTrigger
                    id="budget-measurement"
                    className="w-full"
                    aria-label="Budget measurement"
                    aria-describedby={measurementDescriptionId}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {BUDGET_MEASUREMENT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {budgetMeasurementLabel[mode]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription id={measurementDescriptionId}>
                  {budgetMeasurementDescription[value]}
                </FieldDescription>
              </>
            );
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="budget-rollover">Rollover</FieldLabel>
        <Controller
          control={control}
          name="rolloverMode"
          render={({ field }) => {
            const value = field.value ?? "off";
            return (
              <>
                <Select
                  items={BUDGET_ROLLOVER_MODES.map((mode) => ({
                    label: budgetRolloverOptionLabel[mode],
                    value: mode,
                  }))}
                  value={value}
                  onValueChange={(next) => {
                    if (next === "off" || next === "previousPeriodOnly" || next === "cumulative") {
                      field.onChange(next);
                    }
                  }}
                >
                  <SelectTrigger
                    id="budget-rollover"
                    className="w-full"
                    aria-label="Budget rollover"
                    aria-describedby={rolloverDescriptionId}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {BUDGET_ROLLOVER_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {budgetRolloverOptionLabel[mode]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription id={rolloverDescriptionId}>
                  {budgetRolloverDescription[value]}
                </FieldDescription>
              </>
            );
          }}
        />
      </Field>
    </FieldGroup>
  );
}

export { BudgetFormRulesFields };
