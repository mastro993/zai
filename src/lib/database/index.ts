import TauriDatabase from "@tauri-apps/plugin-sql";
import { Kysely, ParseJSONResultsPlugin } from "kysely";
import { TransactionCategoryTable } from "@/features/transaction-category/schema";
import { TransactionTable } from "@/features/transaction/schema";
import { appDataDir } from "@tauri-apps/api/path";
import { TauriSqliteDialect } from "kysely-dialect-tauri";

export type Database = {
  transaction: TransactionTable;
  transaction_category: TransactionCategoryTable;
};

const dialect = new TauriSqliteDialect({
  database: async (prefix) =>
    await TauriDatabase.load(`${prefix}${await appDataDir()}zai.db`),
});

export const db = new Kysely<Database>({
  dialect,
  plugins: [new ParseJSONResultsPlugin()],
  log(event): void {
    if (event.level === "query") {
      // console.debug(event.query.sql, event.query.parameters);
    } else if (event.level === "error") {
      console.error(event.error);
    }
  },
});
