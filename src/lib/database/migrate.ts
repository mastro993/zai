import { FileMigrationProvider, Migrator } from "kysely";
import { db } from ".";

// Load all migration files at build time
const migrationFiles = import.meta.glob("/src/lib/database/migrations/*.ts", {
  as: "raw",
  eager: true,
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
      migrationFolder: "/src/lib/database/migrations",
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.info(
        `✅ Migration "${it.migrationName}" was executed successfully`
      );
    } else if (it.status === "Error") {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("❌ Failed to migrate: ", error);
  }
}
