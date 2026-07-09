import { createFileRoute } from "@tanstack/react-router";

import { ScreenBase } from "@/components/screen-base";

export const Route = createFileRoute("/cash-flow/")({
  component: CashFlowOverviewPage,
});

function CashFlowOverviewPage() {
  return <ScreenBase />;
}
