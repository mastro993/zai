import { db } from "@/lib/database";
import { Expression } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/sqlite";

function children(id: Expression<number>) {
  return jsonArrayFrom(
    db
      .selectFrom("transaction_categories as children")
      .select([
        "children.id",
        "children.name",
        "children.color",
        "children.icon",
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

function parent(parentId: Expression<number>) {
  return jsonObjectFrom(
    db
      .selectFrom("transaction_categories as parent")
      .select([
        "parent.id",
        "parent.name",
        "parent.color",
        "parent.icon",
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
