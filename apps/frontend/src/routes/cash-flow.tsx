import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow")({
  component: CashFlowLayout,
});

function CashFlowLayout() {
  return <Outlet />;
}
