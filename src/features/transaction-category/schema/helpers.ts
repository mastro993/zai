import { db } from "@/lib/database";
import { Expression } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/sqlite";

function children(id: Expression<number | null>) {
  return jsonArrayFrom(
    db
      .selectFrom("transaction_category as children")
      .select([
        "children.id",
        "children.name",
        "children.color",
        "children.description",
        "children.parent_id",
        "children.created_at",
        "children.updated_at",
        "children.deleted_at",
      ])
      .whereRef("children.parent_id", "=", id)
      .orderBy("children.name")
  );
}

function parent(parentId: Expression<number | null>) {
  return jsonObjectFrom(
    db
      .selectFrom("transaction_category as parent")
      .select([
        "parent.id",
        "parent.name",
        "parent.color",
        "parent.description",
        "parent.parent_id",
        "parent.created_at",
        "parent.updated_at",
        "parent.deleted_at",
      ])
      .whereRef("parent.id", "=", parentId)
  );
}

export { children, parent };
