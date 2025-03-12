import { useTransactionList } from "@/api/transactions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, isLoading, error } = useTransactionList();

  console.log(data, isLoading, error);

  return <div>Hello "/transactions/"!</div>;
}
