import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ForecastPrototypeScreen } from "@/features/budgets/screens/forecast-prototype/forecast-prototype-screen";

const forecastSearchSchema = z.object({
  variant: z.enum(["A", "B", "C"]).default("A"),
});

export const Route = createFileRoute("/cash-flow/forecast")({
  validateSearch: forecastSearchSchema,
  component: CashFlowForecastPrototypePage,
});

function CashFlowForecastPrototypePage() {
  const { variant } = Route.useSearch();
  return <ForecastPrototypeScreen variant={variant} />;
}
