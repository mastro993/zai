import { useTransactionList } from "@/api/transactions";
import { JsonDisplay } from "@/components/ui/JsonDisplay";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/transactions/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, isLoading, error } = useTransactionList();
  const transactions = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <div>
        <div className="navbar bg-base-100 flex justify-between">
          <div className="breadcrumbs text-sm px-4">
            <ul>
              <li>
                <a>Transactions</a>
              </li>
              <li>
                <a>Documents</a>
              </li>
              <li>Add Document</li>
            </ul>
          </div>
          <button
            className="btn"
            onClick={() => document.getElementById("my_modal_1").showModal()}
          >
            open modal
          </button>
        </div>
        <ul className="list">
          {transactions.map((transaction, index) => (
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
