import { db } from "@/lib/database";
import { useQuery } from "@tanstack/react-query";
import { TransactionCategory } from "../schema";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/sqlite";
import { Expression } from "kysely";

function children(parentId: Expression<number>) {
  return jsonArrayFrom(
    db
      .selectFrom("transaction_categories as cat")
      .select([
        "cat.id",
        "cat.name",
        "cat.color",
        "cat.icon",
        "cat.description",
        "cat.parent_id",
        "cat.created_at",
        "cat.updated_at",
        "cat.deleted_at",
      ])
      .whereRef("cat.parent_id", "=", parentId)
      .orderBy("cat.name")
  );
}

function parent(parentId: Expression<number>) {
  return jsonObjectFrom(
    db
      .selectFrom("transaction_categories as cat")
      .select([
        "cat.id",
        "cat.name",
        "cat.color",
        "cat.icon",
        "cat.description",
        "cat.parent_id",
        "cat.created_at",
        "cat.updated_at",
        "cat.deleted_at",
      ])
      .whereRef("cat.id", "=", parentId)
  );
}

export const useTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () => {
      const dbTransactionCategories = await db
        .selectFrom("transaction_categories")
        .selectAll()
        .select(({ ref }) => [
          children(ref("parent_id")).as("children"),
          parent(ref("parent_id")).as("parent"),
        ])
        .execute();

      console.log(dbTransactionCategories);

      return dbTransactionCategories;
    },
  });
