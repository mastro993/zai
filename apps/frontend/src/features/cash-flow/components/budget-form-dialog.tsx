import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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

import { budgetFormSchema, type BudgetFormInput, type BudgetFormValues } from "../types/budget";

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BudgetFormValues) => Promise<boolean>;
}

export function BudgetFormDialog({ open, onOpenChange, onSubmit }: BudgetFormDialogProps) {
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { name: "", baseAllowance: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = async (values: BudgetFormValues) => {
    const saved = await onSubmit(values);
    if (saved) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Create a monthly spending budget for all transactions. The first month is never
            prorated.
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
              <FieldError>{errors.name?.message}</FieldError>
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
                Amount in EUR. Spending mode and 80% warning are enabled by default.
              </FieldDescription>
              <FieldError>{errors.baseAllowance?.message}</FieldError>
            </Field>
          </FieldGroup>
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
