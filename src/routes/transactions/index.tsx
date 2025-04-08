import { Navbar } from "@/components/ui/Navbar";
import { TransactionAddButton } from "@/features/transaction/components/TransactionAddButton";
import { TransactionSearchBar } from "@/features/transaction/components/TransactionSearchBar";
import { TransactionsList } from "@/features/transaction/components/TransactionsList";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/")({
  component: RouteComponent,
});

function RouteComponent() {
  const actions = (
    <div className="navbar-end flex gap-2">
      <TransactionAddButton />
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Navbar title="Transactions" actions={actions}>
        <TransactionSearchBar />
      </Navbar>
      <TransactionsList />
    </div>
  );
}
