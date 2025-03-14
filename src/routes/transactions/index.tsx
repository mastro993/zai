import { JsonDisplay } from "@/components/ui/JsonDisplay";
import { useAddTransaction, useTransactionList } from "@/lib/api/transactions";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";
import { useHotkeys } from "react-hotkeys-hook";

export const Route = createFileRoute("/transactions/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { mutate: addTransaction } = useAddTransaction();
  const { data, isLoading, error } = useTransactionList();
  const transactions = data?.pages.flatMap((page) => page.data) ?? [];

  const searchRef = useRef<HTMLInputElement>(null);

  useHotkeys("mod+k", () => {
    searchRef.current?.focus();
  });

  const handleAddTransaction = () => {
    addTransaction({
      description: "Test",
      amount: 100,
      date: "2021-01-01",
      type: "income",
      category_id: 1,
      notes: "Test",
    });
    toast.success("Transaction added");
  };

  return (
    <>
      <div>
        <div className="navbar bg-base-100 flex justify-between px-5">
          <h1 className="text-lg text-content">Transactions</h1>
          <label className="input ">
            <Search className="w-4 h-4 text-content" />
            <input
              type="search"
              className="grow"
              placeholder="Search"
              ref={searchRef}
            />
            <kbd className="kbd kbd-sm">⌘</kbd>
            <kbd className="kbd kbd-sm">K</kbd>
          </label>
          <div className="flex gap-2">
            <button className="btn" onClick={handleAddTransaction}>
              <Plus className="w-4 h-4" />
              Add transaction
            </button>
          </div>
        </div>
        <ul className="list">
          {data?.pages
            .flatMap((page) => page.data)
            .map((transaction, index) => (
              <li className="list-row">
                <JsonDisplay key={index} data={transaction} />
              </li>
            ))}
        </ul>
      </div>
      <dialog id="my_modal_1" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Hello!</h3>
          <p className="py-4">
            Press ESC key or click the button below to close
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
