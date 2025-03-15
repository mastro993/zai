import TauriDatabase from "@tauri-apps/plugin-sql";
import { Kysely, ParseJSONResultsPlugin } from "kysely";
import { TauriSqliteDialect } from "./driver/TauriSqliteDialect";
import { TransactionCategoryTable } from "@/features/transaction-category/schema";
import { TransactionTable } from "@/features/transaction/schema";

export type Database = {
  transaction: TransactionTable;
  transaction_category: TransactionCategoryTable;
};

const dialect = new TauriSqliteDialect({
  database: await TauriDatabase.load("sqlite:myfin.db"),
});

export const db = new Kysely<Database>({
  dialect,
  plugins: [new ParseJSONResultsPlugin()],
  log(event): void {
    if (event.level === "query") {
      console.debug(event.query.sql, event.query.parameters);
    } else if (event.level === "error") {
      console.error(event.error);
    }
  },
});
