import { db } from "@/lib/database";
import { Expression } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/sqlite";

function category(categoryId: Expression<number>) {
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
      .whereRef("cat.id", "=", categoryId)
  );
}

export { category };
