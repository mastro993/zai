import TauriDatabase from "@tauri-apps/plugin-sql";
import { Kysely } from "kysely";
import { TransactionTable } from "./schema/transaction";
import { TauriSqliteDialect } from "./driver/TauriSqliteDialect";

export type Database = {
  transactions: TransactionTable;
};

const dialect = new TauriSqliteDialect({
  database: await TauriDatabase.load("sqlite:myfin.db"),
});

export const db = new Kysely<Database>({
  dialect,
  log(event): void {
    if (event.level === "query") {
      console.debug(event.query.sql, event.query.parameters);
    } else if (event.level === "error") {
      console.error(event.error);
    }
  },
});
