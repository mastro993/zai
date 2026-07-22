import { zodResolver } from "@hookform/resolvers/zod";
import { Result } from "@praha/byethrow";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { CategoryDrawerSelect } from "@/features/categories/components/category-drawer-select";
import type { TransactionCategory } from "@/features/categories/types/model";
import {
  MAX_TRANSACTION_AMOUNT_MINOR,
  prepareAmountForValidation,
} from "@/features/transactions/lib/transaction";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  previewRecurringGenerationRepair,
  repairRecurringGenerationFailure,
} from "../commands/recurring-transactions";
import { formatLocalDateTime } from "../lib/recurring";
import type { RecurringTransactionDocument } from "../types/recurring-transaction";

const amountSchema = z
  .string()
  .trim()
  .transform(prepareAmountForValidation)
  .pipe(
    z
      .string()
      .min(1, "Amount is required")
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid amount")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Amount must be zero or greater")
      .transform((value) => Math.round(Number(value) * 100)),
  )
  .pipe(z.number().int().max(MAX_TRANSACTION_AMOUNT_MINOR, "Amount exceeds supported maximum"));

const categoryRepairSchema = z.object({
  transactionCategoryId: z.string().optional(),
});

const amountRepairSchema = z.object({
  amount: amountSchema,
});

interface RecurringRepairDrawerProps {
  document: RecurringTransactionDocument;
  repairFieldKey: string;
  categories: Array<TransactionCategory>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentChange: (document: RecurringTransactionDocument) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function RecurringRepairDrawer({
  document,
  repairFieldKey,
  categories,
  open,
  onOpenChange,
  onDocumentChange,
  returnFocusRef,
}: RecurringRepairDrawerProps) {
  const unresolved = document.failures.unresolved;
  const isCategory = repairFieldKey === "transaction_category_id";
  const [previewText, setPreviewText] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isCategory ? categoryRepairSchema : amountRepairSchema),
    defaultValues: isCategory
      ? {
          transactionCategoryId: document.template.transactionCategoryId ?? undefined,
        }
      : {
          amount: (document.template.amount / 100).toFixed(2),
        },
  });

  const submit = handleSubmit(async (values) => {
    const templateValues = {
      description: document.template.description,
      amount: isCategory ? document.template.amount : (values as { amount: number }).amount,
      transactionType: document.template.transactionType,
      transactionCategoryId: isCategory
        ? (values as { transactionCategoryId?: string }).transactionCategoryId
        : (document.template.transactionCategoryId ?? undefined),
      notes: document.template.notes ?? undefined,
    };

    const preview = await previewRecurringGenerationRepair(
      document,
      repairFieldKey,
      templateValues,
    );
    if (Result.isFailure(preview)) {
      toast.error(preview.error.message);
      return;
    }
    setPreviewText(
      `Updates ${preview.value.affectedUnfulfilledSegmentCount} unfulfilled segment${
        preview.value.affectedUnfulfilledSegmentCount === 1 ? "" : "s"
      }${preview.value.includesFutureTemplate ? ", including the future template" : ""}.`,
    );

    const result = await repairRecurringGenerationFailure(document, repairFieldKey, templateValues);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    if (result.value.outcome === "unchanged") {
      toast.message("No repair applied.");
      onDocumentChange(result.value.document);
      return;
    }
    onDocumentChange(result.value.document);
    onOpenChange(false);
    queueMicrotask(() => returnFocusRef?.current?.focus());
  });

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Repair generation failure</DrawerTitle>
        <DrawerDescription>
          Fix {isCategory ? "category" : "amount"} for the blocked occurrence
          {unresolved ? ` scheduled ${formatLocalDateTime(unresolved.failedScheduledLocal)}` : ""}.
          Fulfilled transactions stay unchanged.
        </DrawerDescription>
      </DrawerHeader>
      <form
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
        onSubmit={submit}
        aria-hidden={!open}
      >
        <FieldSet>
          <FieldGroup>
            {isCategory ? (
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Controller
                  control={control}
                  name="transactionCategoryId"
                  render={({ field }) => (
                    <CategoryDrawerSelect
                      id="recurring-repair-category"
                      mode="single"
                      categories={categories}
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                      placeholder="Uncategorized"
                      ariaLabel="Repair category"
                      drawerTitle="Choose category"
                      clearable
                      parentOpen={open}
                    />
                  )}
                />
                <FieldError>
                  {errors.transactionCategoryId?.message as string | undefined}
                </FieldError>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>EUR</InputGroupText>
                  </InputGroupAddon>
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                      <InputGroupInput
                        {...field}
                        inputMode="decimal"
                        aria-invalid={Boolean(errors.amount)}
                      />
                    )}
                  />
                </InputGroup>
                <FieldError>{errors.amount?.message as string | undefined}</FieldError>
                <p className="text-sm text-muted-foreground">
                  Current value {formatCurrencyFromMinor(document.template.amount, "EUR")}
                </p>
              </Field>
            )}
          </FieldGroup>
        </FieldSet>
        {previewText ? (
          <p role="status" className="text-sm text-muted-foreground">
            {previewText}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Repair & retry previews qualifying unfulfilled segments, then persists and retries in
            order.
          </p>
        )}
        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Repairing…" : "Repair & retry"}
          </Button>
          <DrawerClose
            render={<Button type="button" variant="outline" />}
            onClick={() => queueMicrotask(() => returnFocusRef?.current?.focus())}
          >
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}
