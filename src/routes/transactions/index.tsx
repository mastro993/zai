import DatePicker from "@/components/DatePicker";
import { Navbar } from "@/components/Navbar";
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
      <DatePicker />
      <TransactionAddButton />
    </div>
  );

  return (
    <div className="flex flex-col">
      <Navbar title="Transactions" actions={actions}>
        <TransactionSearchBar />
      </Navbar>
      <TransactionsList />
    </div>
  );
}
