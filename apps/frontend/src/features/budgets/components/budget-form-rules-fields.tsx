import {
  Calendar02Icon,
  Calendar03Icon,
  Calendar05Icon,
  CalendarsIcon,
  Layers01Icon,
  MoneyExchange01Icon,
  RepeatOffIcon,
  ShoppingBag01Icon,
  Undo03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ComponentProps, useEffect, useState } from "react";
import { type Control, Controller } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import {
  budgetMeasurementDescription,
  budgetMeasurementLabel,
  budgetRolloverDescription,
  budgetRolloverOptionLabel,
} from "../lib/budget";
import {
  BUDGET_MEASUREMENT_MODES,
  BUDGET_ROLLOVER_MODES,
  type BudgetCadence,
  type BudgetFormInput,
  type BudgetFormValues,
  type BudgetMeasurementMode,
  type BudgetRolloverMode,
} from "../types/budget";

interface BudgetFormRulesFieldsProps {
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
  formOpen: boolean;
}

type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

interface BudgetRuleOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: HugeIcon;
}

interface BudgetRuleComboboxProps<T extends string> {
  id: string;
  descriptionId: string;
  value: T | undefined;
  options: Array<BudgetRuleOption<T>>;
  placeholder: string;
  ariaLabel: string;
  parentOpen: boolean;
  disabled?: boolean;
  onChange: (value: T) => void;
  onBlur?: () => void;
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

const MEASUREMENT_OPTIONS: Array<BudgetRuleOption<BudgetMeasurementMode>> =
  BUDGET_MEASUREMENT_MODES.map((mode) => ({
    value: mode,
    label: budgetMeasurementLabel[mode],
    description: budgetMeasurementDescription[mode],
    icon: MEASUREMENT_ICONS[mode],
  }));

const ROLLOVER_OPTIONS: Array<BudgetRuleOption<BudgetRolloverMode>> = BUDGET_ROLLOVER_MODES.map(
  (mode) => ({
    value: mode,
    label: budgetRolloverOptionLabel[mode],
    description: budgetRolloverDescription[mode],
    icon: ROLLOVER_ICONS[mode],
  }),
);

const BUDGET_CADENCE_OPTIONS: Array<BudgetRuleOption<BudgetCadence>> = [
  {
    value: "day",
    label: "Day",
    description: "One period for each calendar day.",
    icon: Calendar05Icon,
  },
  {
    value: "week",
    label: "Week",
    description: "One period from Monday to Sunday.",
    icon: Calendar02Icon,
  },
  {
    value: "month",
    label: "Month",
    description: "One period for each calendar month.",
    icon: Calendar03Icon,
  },
  {
    value: "year",
    label: "Year",
    description: "One period for each calendar year.",
    icon: CalendarsIcon,
  },
];

function BudgetRuleCombobox<T extends string>({
  id,
  descriptionId,
  value,
  options,
  placeholder,
  ariaLabel,
  parentOpen,
  disabled = false,
  onChange,
  onBlur,
}: BudgetRuleComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!parentOpen) setOpen(false);
  }, [parentOpen]);

  return (
    <Combobox
      items={options}
      value={selected ?? null}
      open={open}
      disabled={disabled}
      filter={null}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onBlur?.();
      }}
      onValueChange={(nextOption) => {
        if (nextOption) onChange(nextOption.value);
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            type="button"
            disabled={disabled}
            variant="outline"
            aria-label={ariaLabel}
            aria-describedby={descriptionId}
            className="h-8 w-full min-w-0 justify-between gap-2 overflow-hidden px-2.5 font-normal"
          />
        }
      >
        <ComboboxValue>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <HugeiconsIcon icon={selected.icon} data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>

      <ComboboxContent aria-label={`Select ${ariaLabel.toLowerCase()}`}>
        <ComboboxList>
          {(option) => (
            <ComboboxItem
              key={option.value}
              value={option}
              className={cn(
                "items-center gap-3 border border-transparent py-2.5 pl-2 [&>span[data-selected]]:top-1/2 [&>span[data-selected]]:-translate-y-1/2 [&>span[data-selected]]:text-primary",
                selected?.value === option.value
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/5 focus:bg-primary/5"
                  : null,
              )}
            >
              <span
                data-slot="budget-rule-icon"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border",
                  selected?.value === option.value
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
                aria-hidden="true"
              >
                <HugeiconsIcon icon={option.icon} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-4 text-pretty text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function BudgetFormRulesFields({ control, formOpen }: BudgetFormRulesFieldsProps) {
  return (
    <FieldGroup>
      <Controller
        control={control}
        name="measurementMode"
        render={({ field }) => (
          <Field className="min-w-0">
            <FieldLabel htmlFor="budget-measurement">Measurement</FieldLabel>
            <BudgetRuleCombobox<BudgetMeasurementMode>
              id="budget-measurement"
              descriptionId="budget-measurement-description"
              placeholder="Select measurement"
              value={field.value ?? "spending"}
              options={MEASUREMENT_OPTIONS}
              ariaLabel="Budget measurement"
              parentOpen={formOpen}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            <FieldDescription id="budget-measurement-description">
              Choose whether the budget tracks spending or net cash flow.
            </FieldDescription>
          </Field>
        )}
      />
      <Controller
        control={control}
        name="rolloverMode"
        render={({ field }) => (
          <Field className="min-w-0">
            <FieldLabel htmlFor="budget-rollover">Rollover</FieldLabel>
            <BudgetRuleCombobox<BudgetRolloverMode>
              id="budget-rollover"
              descriptionId="budget-rollover-description"
              placeholder="Select rollover"
              value={field.value ?? "off"}
              options={ROLLOVER_OPTIONS}
              ariaLabel="Budget rollover"
              parentOpen={formOpen}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            <FieldDescription id="budget-rollover-description">
              Choose how leftover allowance or overspend carries into future periods.
            </FieldDescription>
          </Field>
        )}
      />
    </FieldGroup>
  );
}

export { BUDGET_CADENCE_OPTIONS, BudgetFormRulesFields, BudgetRuleCombobox };
