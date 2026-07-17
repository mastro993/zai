import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type Control, type FieldErrors } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import type { BudgetFormInput, BudgetFormValues } from "../types/budget";
import { BudgetFormRulesFields } from "./budget-form-rules-fields";

interface BudgetFormRulesDrawerProps {
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
  errors: FieldErrors<BudgetFormInput>;
}

function BudgetFormRulesDrawer({ control, errors }: BudgetFormRulesDrawerProps) {
  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader className="flex-row items-start gap-2">
        <DrawerClose
          render={
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to budget" />
          }
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
        </DrawerClose>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DrawerTitle>Advanced rules</DrawerTitle>
          <DrawerDescription>
            Measurement, rollover, and warning threshold for this budget.
          </DrawerDescription>
        </div>
      </DrawerHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <BudgetFormRulesFields control={control} errors={errors} />
      </div>

      <DrawerFooter>
        <DrawerClose render={<Button type="button" />}>Done</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  );
}

export { BudgetFormRulesDrawer };
