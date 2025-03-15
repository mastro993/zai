import { Navbar } from "@/components/layout/Navbar";
import { JsonDisplay } from "@/components/ui/JsonDisplay";
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

  return (
    <>
      <div>
        <Navbar>
          <div className="navbar-start">
            <h1 className="text-lg text-content">Transactions</h1>
          </div>
          <div className="navbar-center">
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
          </div>
          <div className=" navbar-end flex gap-2">
            <button className="btn" onClick={handleAddTransaction}>
              <Plus className="w-4 h-4" />
              Add transaction
            </button>
          </div>
        </Navbar>
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
};
