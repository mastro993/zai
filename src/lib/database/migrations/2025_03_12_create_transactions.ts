import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("transaction_category")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("parent_id", "integer", (col) =>
      col.references("transaction_category.id").onDelete("set null")
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("color", "text")
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
    .createTable("transaction")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("category_id", "integer", (col) =>
      col.references("transaction_category.id")
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

  await db.schema
    .createIndex("transaction_type_index")
    .on("transaction")
    .column("type")
    .execute();

  await db.schema
    .createIndex("transaction_category_id_index")
    .on("transaction")
    .column("category_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("transaction_type_index").execute();
  await db.schema.dropIndex("transaction_category_id_index").execute();
  await db.schema.dropTable("transaction").execute();
  await db.schema.dropTable("transaction_category").execute();
}
