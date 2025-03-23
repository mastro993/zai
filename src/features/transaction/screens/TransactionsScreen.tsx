import { JsonDisplay } from "@/components/JsonDisplay";
import { Navbar } from "@/components/ui/Navbar";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Plus, Search } from "lucide-react";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAddTransaction } from "../api/useAddTransaction";
import { useTransactionList } from "../api/useTransactionList";

export const TransactionsScreen = () => {
  const { mutate: addTransaction } = useAddTransaction();
  const { data } = useTransactionList();

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
  };

  const actions = (
    <div className="navbar-end flex gap-2">
      <button className="btn btn-sm btn-primary" onClick={handleAddTransaction}>
        <Plus className="w-4 h-4" />
        Add transaction
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Navbar title="Transactions" actions={actions}>
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
      </Navbar>
      <div className="overflow-auto">
        <ScrollArea>
          <ul className="list">
            {data?.pages
              .flatMap((page) => page.data)
              .map((transaction, index) => (
                <li className="list-row">
                  <JsonDisplay key={index} data={transaction} />
                </li>
              ))}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
};
