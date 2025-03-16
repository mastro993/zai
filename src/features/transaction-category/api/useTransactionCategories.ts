import { db } from "@/lib/database";
import { useQuery } from "@tanstack/react-query";
import { TransactionCategory } from "../schema";
import { children, parent } from "./helpers";

type Params = {
  asParents?: boolean;
};

const DEFAULT_PARAMS: Params = {
  asParents: false,
};

export const useTransactionCategories = ({
  asParents = false,
}: Params = DEFAULT_PARAMS) =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () =>
      db
        .selectFrom("transaction_category")
        .$if(asParents, (qb) => qb.where("parent_id", "is", null))
        .selectAll("transaction_category")
        .select(({ ref }) => [
          children(ref("transaction_category.id")).as("children"),
          parent(ref("transaction_category.parent_id")).as("parent"),
        ])
        .execute(),
  });
