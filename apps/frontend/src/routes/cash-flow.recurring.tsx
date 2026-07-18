import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RecurringPrototypeScreen } from "@/features/cash-flow/screens/recurring-prototype/recurring-prototype-screen";

const recurringSearchSchema = z.object({
  variant: z.enum(["A", "B", "C"]).default("A"),
});

export const Route = createFileRoute("/cash-flow/recurring")({
  validateSearch: recurringSearchSchema,
  component: CashFlowRecurringPrototypePage,
});

function CashFlowRecurringPrototypePage() {
  const { variant } = Route.useSearch();
  return <RecurringPrototypeScreen variant={variant} />;
}
