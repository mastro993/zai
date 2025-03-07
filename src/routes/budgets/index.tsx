import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/budgets/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/budgets/"!</div>;
}
