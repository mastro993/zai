import { Navbar } from "@/components/Navbar";
import { TransactionCategoryAddButton } from "@/features/transaction-category/components/TransactionCategoryAddButton";
import { TransactionCategoryExportButton } from "@/features/transaction-category/components/TransactionCategoryExportButton";
import { TransactionCategoryImportButton } from "@/features/transaction-category/components/TransactionCategoryImportButton";
import { TransactionCategoryList } from "@/features/transaction-category/components/TransactionCategoryList";
import { TransactionCategorySelection } from "@/features/transaction-category/components/TransactionCategorySelection";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/categories/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navbarActions = (
    <div className="flex gap-2">
      <TransactionCategorySelection />
      <TransactionCategoryImportButton />
      <TransactionCategoryExportButton />
      <TransactionCategoryAddButton />
    </div>
  );

  return (
    <div className="flex flex-col">
      <Navbar title="Categories" actions={navbarActions} />
      <TransactionCategoryList />
    </div>
  );
}
