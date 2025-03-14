import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("transactions")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("category_id", "integer")
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
}
