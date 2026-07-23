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
import type {
  RecurringRepairPreview,
  RecurringRepairField,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";

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

interface RepairFormValues {
  transactionCategoryId?: string;
  amount: string;
}

const repairFormSchema = z.object({
  transactionCategoryId: z.string().optional(),
  amount: z.string(),
});

interface RecurringRepairDrawerProps {
  document: RecurringTransactionDocument;
  repairFieldKey: RecurringRepairField;
  categories: Array<TransactionCategory>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentChange: (document: RecurringTransactionDocument) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

interface PreparedTemplateValues {
  description: string;
  amount: number;
  transactionType: "expense" | "income";
  transactionCategoryId?: string;
  notes?: string;
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
  const isCategory = repairFieldKey === "transactionCategoryId";
  const [preview, setPreview] = useState<RecurringRepairPreview>();
  const [prepared, setPrepared] = useState<PreparedTemplateValues>();
  const [isConfirming, setIsConfirming] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RepairFormValues>({
    resolver: zodResolver(repairFormSchema),
    defaultValues: {
      transactionCategoryId: document.template.transactionCategoryId ?? undefined,
      amount: (document.template.amount / 100).toFixed(2),
    },
  });

  const closeAndReturnFocus = () => {
    onOpenChange(false);
    queueMicrotask(() => returnFocusRef?.current?.focus());
  };

  const proposedValue = prepared
    ? isCategory
      ? prepared.transactionCategoryId
        ? (categories.find((category) => category.id === prepared.transactionCategoryId)?.name ??
          "Selected category")
        : "Uncategorized"
      : formatCurrencyFromMinor(prepared.amount, "EUR")
    : null;

  const onPreview = handleSubmit(async (values) => {
    let amount = document.template.amount;
    if (!isCategory) {
      const parsedAmount = amountSchema.safeParse(values.amount);
      if (!parsedAmount.success) {
        setError("amount", {
          type: "manual",
          message: parsedAmount.error.issues[0]?.message ?? "Enter a valid amount",
        });
        return;
      }
      amount = parsedAmount.data;
    }

    const templateValues: PreparedTemplateValues = {
      description: document.template.description,
      amount,
      transactionType: document.template.transactionType,
      transactionCategoryId: isCategory
        ? values.transactionCategoryId
        : (document.template.transactionCategoryId ?? undefined),
      notes: document.template.notes ?? undefined,
    };

    const result = await previewRecurringGenerationRepair(document, repairFieldKey, templateValues);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    setPrepared(templateValues);
    setPreview(result.value);
  });

  const onConfirm = async () => {
    if (!prepared || !preview) {
      return;
    }
    setIsConfirming(true);
    const result = await repairRecurringGenerationFailure(document, repairFieldKey, prepared);
    setIsConfirming(false);
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
    closeAndReturnFocus();
  };

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
        onSubmit={onPreview}
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
                      onChange={(value) => {
                        setPreview(undefined);
                        setPrepared(undefined);
                        field.onChange(value ?? undefined);
                      }}
                      placeholder="Uncategorized"
                      ariaLabel="Repair category"
                      drawerTitle="Choose category"
                      clearable
                      parentOpen={open}
                    />
                  )}
                />
                <FieldError>{errors.transactionCategoryId?.message}</FieldError>
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
                        onChange={(event) => {
                          setPreview(undefined);
                          setPrepared(undefined);
                          field.onChange(event);
                        }}
                      />
                    )}
                  />
                </InputGroup>
                <FieldError>{errors.amount?.message}</FieldError>
                <p className="text-sm text-muted-foreground">
                  Current value {formatCurrencyFromMinor(document.template.amount, "EUR")}
                </p>
              </Field>
            )}
          </FieldGroup>
        </FieldSet>
        {preview ? (
          <div role="status" className="space-y-1 text-sm">
            <p>
              Proposed {isCategory ? "category" : "amount"}: <strong>{proposedValue}</strong>
            </p>
            <p>
              Preview: updates {preview.affectedUnfulfilledSegmentCount} unfulfilled segment
              {preview.affectedUnfulfilledSegmentCount === 1 ? "" : "s"}
              {preview.includesFutureTemplate ? ", including the future template" : ""}. Confirm to
              persist and retry in order.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Preview the repair across unfulfilled segments before confirming Repair &amp; retry.
          </p>
        )}
        <DrawerFooter>
          {preview ? (
            <Button
              type="button"
              disabled={isConfirming}
              aria-busy={isConfirming}
              onClick={() => void onConfirm()}
            >
              {isConfirming ? "Repairing…" : "Repair & retry"}
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Previewing…" : "Preview repair"}
            </Button>
          )}
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
