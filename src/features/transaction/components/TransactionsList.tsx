import { JsonDisplay } from "@/components/JsonDisplay";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useTransactionList } from "../api/useTransactionList";

export const TransactionsList = () => {
  const { data } = useTransactionList();

  return (
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
  );
};
