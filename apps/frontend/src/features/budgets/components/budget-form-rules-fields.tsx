import {
  Layers01Icon,
  MoneyExchange01Icon,
  RepeatOffIcon,
  ShoppingBag01Icon,
  Undo03Icon,
} from "@hugeicons/core-free-icons";
import { type Control, Controller } from "react-hook-form";

import { DrawerSelect, type DrawerSelectOption } from "@/components/drawer-select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

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

const MEASUREMENT_OPTIONS: Array<DrawerSelectOption<BudgetMeasurementMode>> =
  BUDGET_MEASUREMENT_MODES.map((mode) => ({
    value: mode,
    label: budgetMeasurementLabel[mode],
    description: budgetMeasurementDescription[mode],
    icon: MEASUREMENT_ICONS[mode],
  }));

const ROLLOVER_OPTIONS: Array<DrawerSelectOption<BudgetRolloverMode>> = BUDGET_ROLLOVER_MODES.map(
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
          <Field className="min-w-0">
            <FieldLabel htmlFor="budget-measurement">Measurement</FieldLabel>
            <DrawerSelect<BudgetMeasurementMode>
              id="budget-measurement"
              ariaLabel="Budget measurement"
              drawerTitle="Measurement"
              drawerDescription="Choose how transactions in scope count toward this budget."
              placeholder="Select measurement"
              value={field.value ?? "spending"}
              options={MEASUREMENT_OPTIONS}
              parentOpen={formOpen}
              backAriaLabel="Back to budget"
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="rolloverMode"
        render={({ field }) => (
          <Field className="min-w-0">
            <FieldLabel htmlFor="budget-rollover">Rollover</FieldLabel>
            <DrawerSelect<BudgetRolloverMode>
              id="budget-rollover"
              ariaLabel="Budget rollover"
              drawerTitle="Rollover"
              drawerDescription="Choose whether unused allowance or overspend carries into later periods."
              placeholder="Select rollover"
              value={field.value ?? "off"}
              options={ROLLOVER_OPTIONS}
              parentOpen={formOpen}
              backAriaLabel="Back to budget"
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </Field>
        )}
      />
    </FieldGroup>
  );
}

export { BudgetFormRulesFields };
