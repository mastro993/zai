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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { getCategoryDisplayColor } from "../lib/category";
import {
  combineDateTime,
  formatAmountFromMinor,
  isPartialAmountInput,
  normalizeAmountInput,
  splitDateTime,
  toDateTimeInputValue,
} from "../lib/transaction";
import {
  TRANSACTION_TYPES,
  transactionFormSchema,
  type TransactionCategory,
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

function CategoryDot({ color }: { color: string }) {
  return (
    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
  );
}

function TransactionFormDrawer({
  mode,
  categories,
  onSubmit,
}: {
  mode: TransactionFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}) {
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const { title, description } = getFormCopy(mode);
  const isCreate = mode.type === "create";
  const rootCategories = categories.filter((category) => !category.parentId);
  const childCategories = categories.filter((category) => category.parentId);
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const parentCategoryItems = [
    { label: "Uncategorized", value: null, color: null },
    ...rootCategories.map((category) => ({
      label: category.name,
      value: category.id,
      color: getCategoryDisplayColor(category),
    })),
  ];
  const { errors, isSubmitting } = form.formState;
  const amountErrorId = "transaction-amount-error";
  const dateErrorId = "transaction-date-error";
  const typeErrorId = "transaction-type-error";

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
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

          <Controller
            control={form.control}
            name="transactionCategoryId"
            render={({ field }) => {
              const selectedCategory = field.value ? categoryById.get(field.value) : undefined;
              const selectedParentId = selectedCategory?.parentId ?? selectedCategory?.id ?? "";
              const selectedChildId = selectedCategory?.parentId ? selectedCategory.id : "";
              const selectedChildren = childCategories.filter(
                (category) => category.parentId === selectedParentId,
              );
              const childCategoryItems = [
                { label: "Other", value: null },
                ...selectedChildren.map((category) => ({
                  label: category.name,
                  value: category.id,
                })),
              ];

              return (
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <div className="flex flex-col gap-2">
                    <Select
                      items={parentCategoryItems}
                      value={selectedParentId || null}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full" aria-label="Parent category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {parentCategoryItems.map((item) => (
                            <SelectItem key={item.value ?? "uncategorized"} value={item.value}>
                              <span className="flex items-center gap-2">
                                {item.color ? <CategoryDot color={item.color} /> : null}
                                {item.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    {selectedChildren.length > 0 ? (
                      <div className="border-l border-border pl-3">
                        <Select
                          items={childCategoryItems}
                          value={selectedChildId || null}
                          onValueChange={(value) => field.onChange(value ?? selectedParentId)}
                        >
                          <SelectTrigger className="min-w-0 w-full" aria-label="Child category">
                            <SelectValue placeholder="Other" />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              {childCategoryItems.map((item) => (
                                <SelectItem key={item.value ?? "other"} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                  <FieldDescription>
                    {rootCategories.length > 0
                      ? "Optional. Pick a root category, then refine with a subcategory when available."
                      : "Optional. Create categories under Cash flow → Categories to group transactions."}
                  </FieldDescription>
                </Field>
              );
            }}
          />

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
