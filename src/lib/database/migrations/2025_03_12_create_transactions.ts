import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("transaction_categories")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("parent_id", "integer", (col) =>
      col.references("transaction_categories.id").onDelete("set null")
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("color", "text", (col) => col.notNull())
    .addColumn("icon", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`current_timestamp`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`current_timestamp`)
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("transactions")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("category_id", "integer", (col) =>
      col.references("transaction_categories.id").onDelete("set null")
    )
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`current_timestamp`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`current_timestamp`)
    )
    .addColumn("deleted_at", "timestamp")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("transactions").execute();
  await db.schema.dropTable("transaction_categories").execute();
}
