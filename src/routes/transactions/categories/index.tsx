import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/categories/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/transactions/categories/"!</div>;
}
