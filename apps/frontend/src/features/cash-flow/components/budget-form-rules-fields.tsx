import {
  Layers01Icon,
  MoneyExchange01Icon,
  RepeatOffIcon,
  ShoppingBag01Icon,
  Undo03Icon,
} from "@hugeicons/core-free-icons";
import { type Control, Controller } from "react-hook-form";

import { FieldGroup } from "@/components/ui/field";

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
  type BudgetMeasurementMode,
  type BudgetRolloverMode,
} from "../types/budget";
import { BudgetFormOptionField, type BudgetFormOption } from "./budget-form-option-field";

interface BudgetFormRulesFieldsProps {
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
  formOpen: boolean;
}

const MEASUREMENT_ICONS = {
  spending: ShoppingBag01Icon,
  netCashFlow: MoneyExchange01Icon,
} as const;

const ROLLOVER_ICONS = {
  off: RepeatOffIcon,
  previousPeriodOnly: Undo03Icon,
  cumulative: Layers01Icon,
} as const;

const MEASUREMENT_OPTIONS: Array<BudgetFormOption<BudgetMeasurementMode>> =
  BUDGET_MEASUREMENT_MODES.map((mode) => ({
    value: mode,
    label: budgetMeasurementLabel[mode],
    description: budgetMeasurementDescription[mode],
    icon: MEASUREMENT_ICONS[mode],
  }));

const ROLLOVER_OPTIONS: Array<BudgetFormOption<BudgetRolloverMode>> = BUDGET_ROLLOVER_MODES.map(
  (mode) => ({
    value: mode,
    label: budgetRolloverOptionLabel[mode],
    description: budgetRolloverDescription[mode],
    icon: ROLLOVER_ICONS[mode],
  }),
);

function BudgetFormRulesFields({ control, formOpen }: BudgetFormRulesFieldsProps) {
  return (
    <FieldGroup>
      <Controller
        control={control}
        name="measurementMode"
        render={({ field }) => (
          <BudgetFormOptionField<BudgetMeasurementMode>
            id="budget-measurement"
            label="Measurement"
            ariaLabel="Budget measurement"
            drawerTitle="Measurement"
            drawerDescription="Choose how transactions in scope count toward this budget."
            value={field.value ?? "spending"}
            options={MEASUREMENT_OPTIONS}
            formOpen={formOpen}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <Controller
        control={control}
        name="rolloverMode"
        render={({ field }) => (
          <BudgetFormOptionField<BudgetRolloverMode>
            id="budget-rollover"
            label="Rollover"
            ariaLabel="Budget rollover"
            drawerTitle="Rollover"
            drawerDescription="Choose whether unused allowance or overspend carries into later periods."
            value={field.value ?? "off"}
            options={ROLLOVER_OPTIONS}
            formOpen={formOpen}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
    </FieldGroup>
  );
}

export { BudgetFormRulesFields };
