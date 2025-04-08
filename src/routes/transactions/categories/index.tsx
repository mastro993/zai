import { Navbar } from "@/components/ui/Navbar";
import { TransactionCategoryAddButton } from "@/features/transaction-category/components/TransactionCategoryAddButton";
import { TransactionCategoryList } from "@/features/transaction-category/components/TransactionCategoryList";
import { TransactionCategoryMenu } from "@/features/transaction-category/components/TransactionCategoryMenu";
import { TransactionCategorySelection } from "@/features/transaction-category/components/TransactionCategorySelection";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/categories/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navbarActions = (
    <div className="flex gap-2">
      <TransactionCategorySelection />
      <TransactionCategoryAddButton />
      <TransactionCategoryMenu />
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Navbar title="Categories" actions={navbarActions} />
      <TransactionCategoryList />
    </div>
  );
}
