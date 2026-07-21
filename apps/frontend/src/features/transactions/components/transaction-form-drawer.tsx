import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "@tanstack/react-router";

import type { TransactionRecurringProvenance } from "@/features/recurring-transactions/types/recurring-transaction";

import {
  combineDateTime,
  formatAmountFromMinor,
  isPartialAmountInput,
  normalizeAmountInput,
  splitDateTime,
  toDateTimeInputValue,
} from "../lib/transaction";
import type { TransactionCategory } from "@/features/categories/types/model";
import { CategoryDrawerSelect } from "@/features/categories/components/category-drawer-select";

import {
  TRANSACTION_TYPES,
  transactionFormSchema,
  type TransactionFormInput,
  type TransactionFormValues,
  type TransactionType,
} from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

const getLocalDateTimeInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const getFormDefaults = (mode: TransactionFormMode): TransactionFormInput => {
  if (mode.type === "create") {
    return {
      description: "",
      amount: "0.00",
      transactionDate: getLocalDateTimeInputValue(),
      transactionType: "expense",
      transactionCategoryId: "",
      notes: "",
    };
  }

  return {
    description: mode.transaction.description ?? "",
    amount: formatAmountFromMinor(mode.transaction.amount),
    transactionDate: toDateTimeInputValue(mode.transaction.transactionDate),
    transactionType: mode.transaction.transactionType as TransactionType,
    transactionCategoryId: mode.transaction.transactionCategoryId ?? "",
    notes: mode.transaction.notes ?? "",
  };
};

const getFormCopy = (mode: TransactionFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit transaction",
      description: "Update the amount, date, or category. Changes apply to this entry only.",
    };
  }

  return {
    title: "New transaction",
    description: "Record income or an expense. Category is optional.",
  };
};

const formatDateLabel = (dateValue: string) => {
  if (!dateValue) {
    return "Pick a date";
  }

  return format(parseISO(dateValue), "MMM d, yyyy");
};

function TransactionFormDrawer({
  mode,
  categories,
  onSubmit,
  open = true,
  recurringProvenance = null,
}: {
  mode: TransactionFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  open?: boolean;
  recurringProvenance?: TransactionRecurringProvenance | null;
}) {
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const { title, description } = getFormCopy(mode);
  const isCreate = mode.type === "create";
  const hasCategories = categories.length > 0;
  const { errors, isSubmitting } = form.formState;
  const amountErrorId = "transaction-amount-error";
  const dateErrorId = "transaction-date-error";
  const typeErrorId = "transaction-type-error";
  const visibleSource = recurringProvenance?.source;

  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem]">
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
        {visibleSource ? (
          <p className="pt-2 text-sm">
            <Link
              to="/cash-flow/recurring/$recurringTransactionId"
              params={{ recurringTransactionId: visibleSource.id }}
              className="underline-offset-4 hover:underline"
            >
              Part of recurring: {visibleSource.description}
            </Link>
          </p>
        ) : null}
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FieldGroup className="flex-1 overflow-y-auto p-4">
          <Field data-invalid={Boolean(errors.transactionType)}>
            <FieldLabel>Type</FieldLabel>
            <Controller
              control={form.control}
              name="transactionType"
              render={({ field }) => (
                <ToggleGroup
                  aria-describedby={errors.transactionType ? typeErrorId : undefined}
                  aria-invalid={Boolean(errors.transactionType)}
                  aria-label="Transaction type"
                  className="w-full"
                  spacing={0}
                  variant="outline"
                  value={[field.value]}
                  onValueChange={(values) => {
                    const nextValue = values.at(-1);

                    if (nextValue === "expense" || nextValue === "income") {
                      field.onChange(nextValue);
                    }
                  }}
                >
                  {TRANSACTION_TYPES.map((type) => (
                    <ToggleGroupItem key={type} value={type} className="flex-1 capitalize">
                      {type}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
            <FieldError id={typeErrorId}>{errors.transactionType?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.amount)}>
            <FieldLabel htmlFor="transaction-amount">Amount</FieldLabel>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <InputGroup>
                  <InputGroupInput
                    id="transaction-amount"
                    type="text"
                    inputMode="decimal"
                    autoFocus={isCreate}
                    placeholder="0.00"
                    aria-describedby={errors.amount ? amountErrorId : undefined}
                    aria-invalid={Boolean(errors.amount)}
                    value={field.value ?? ""}
                    onBlur={(event) => {
                      field.onBlur();
                      const normalized = normalizeAmountInput(event.target.value);

                      if (normalized !== event.target.value) {
                        field.onChange(normalized);
                      }
                    }}
                    name={field.name}
                    ref={field.ref}
                    onChange={(event) => {
                      const nextValue = event.target.value;

                      if (isPartialAmountInput(nextValue)) {
                        field.onChange(nextValue);
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>EUR</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              )}
            />
            <FieldDescription>Zero or greater. Enter the value in euros.</FieldDescription>
            <FieldError id={amountErrorId}>{errors.amount?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.transactionDate)}>
            <FieldLabel>Date</FieldLabel>
            <Controller
              control={form.control}
              name="transactionDate"
              render={({ field }) => {
                const { date, time } = splitDateTime(field.value);
                const selectedDate = date ? parseISO(date) : undefined;

                return (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="min-w-0 flex-1 justify-start font-normal"
                            aria-describedby={errors.transactionDate ? dateErrorId : undefined}
                            aria-invalid={Boolean(errors.transactionDate)}
                          />
                        }
                      >
                        {formatDateLabel(date)}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(nextDate) => {
                            if (!nextDate) {
                              return;
                            }

                            field.onChange(combineDateTime(format(nextDate, "yyyy-MM-dd"), time));
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      id="transaction-time"
                      type="time"
                      className="w-28 shrink-0 bg-background"
                      aria-invalid={Boolean(errors.transactionDate)}
                      value={time}
                      onChange={(event) => {
                        field.onChange(combineDateTime(date, event.target.value));
                      }}
                    />
                  </div>
                );
              }}
            />
            <FieldDescription>Date and time when the transaction occurred.</FieldDescription>
            <FieldError id={dateErrorId}>{errors.transactionDate?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-category-trigger">Category</FieldLabel>
            <Controller
              control={form.control}
              name="transactionCategoryId"
              render={({ field }) => (
                <CategoryDrawerSelect
                  id="transaction-category-trigger"
                  mode="single"
                  categories={categories}
                  value={field.value ? field.value : null}
                  onChange={(next) => field.onChange(next ?? "")}
                  onBlur={field.onBlur}
                  parentOpen={open}
                  clearable
                  placeholder="Uncategorized"
                  ariaLabel="Choose category"
                  drawerTitle="Select category"
                  drawerDescription="Optional. Pick a category for this transaction."
                  backAriaLabel="Back to transaction"
                  emptyListMessage="No categories yet. Create some under Cash flow → Categories."
                />
              )}
            />
            <FieldDescription>
              {hasCategories
                ? "Optional. Leave empty for uncategorized."
                : "Optional. Create categories under Cash flow → Categories to group transactions."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-description">Description</FieldLabel>
            <Input
              id="transaction-description"
              placeholder="Coffee, salary, rent..."
              {...form.register("description")}
            />
            <FieldDescription>Short label shown in the transaction list.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-notes">Notes</FieldLabel>
            <Textarea
              id="transaction-notes"
              placeholder="Optional details for your own reference"
              className="min-h-16 resize-y"
              {...form.register("notes")}
            />
          </Field>
        </FieldGroup>

        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save transaction"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { TransactionFormDrawer };
