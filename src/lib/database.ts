import TauriDatabase from "@tauri-apps/plugin-sql";
import {
  Kysely,
  ParseJSONResultsPlugin,
  FileMigrationProvider,
  Migrator,
} from "kysely";
import { TransactionCategoryTable } from "@/features/transaction-category/schema";
import { TransactionTable } from "@/features/transaction/schema";
import { appDataDir } from "@tauri-apps/api/path";
import { TauriSqliteDialect } from "kysely-dialect-tauri";
import { SerializePlugin } from "kysely-plugin-serialize";
import { error, info } from "@tauri-apps/plugin-log";

// Load all migration files at build time
const migrationFiles = import.meta.glob(`/migrations/*.ts`, {
  as: "raw",
  eager: true,
});

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
  plugins: [new ParseJSONResultsPlugin(), new SerializePlugin()],
  log(event): void {
    if (event.level === "error") {
      error("Failed to execute query", {
        keyValues: {
          query: event.query.sql,
          parameters: JSON.stringify(event.query.parameters),
          error: JSON.stringify(event.error),
        },
      });
    }
  },
});

export async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: {
        readdir: async () => {
          return Object.keys(migrationFiles).map(
            (filepath) => filepath.split("/").pop() || ""
          );
        },
      },
      path: {
        join: (...paths: string[]) => {
          // Kysely expects a synchronous join, so we'll join paths directly
          return paths.join("/").replace(/\/+/g, "/");
        },
      },
      migrationFolder: "/migrations",
    }),
  });

  const migrationResult = await migrator.migrateToLatest();

  migrationResult.results?.forEach((it) => {
    if (it.status === "Success") {
      info(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (migrationResult.error) {
    error(`❌ Failed to migrate: ${migrationResult.error}`);
  }
}
