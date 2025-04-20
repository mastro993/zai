import { JsonDisplay } from "@/components/JsonDisplay";
import { useTransactionList } from "../api/useTransactionList";

export const TransactionsList = () => {
  const { data } = useTransactionList();

  return (
    <ul>
      {data?.pages
        .flatMap((page) => page.data)
        .map((transaction, index) => (
          <li>
            <JsonDisplay key={index} data={transaction} />
          </li>
        ))}
    </ul>
  );
};
