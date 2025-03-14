import { db } from "@/lib/database";
import { Expression } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/sqlite";

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

export { children, parent };
