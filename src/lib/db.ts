import Database from "@tauri-apps/plugin-sql";

/**
 * Wraps a function with a database connection.
 * @param fn - The function to wrap.
 * @returns A new function that automatically injects the database instance as the first parameter.
 */
export function withDb<TData, TParam>(
  fn: (db: Database, param: TParam) => Promise<TData>
): (param: TParam) => Promise<TData> {
  return async (param: TParam): Promise<TData> => {
    try {
      const db = await Database.load("sqlite:myfin.db");
      const result = await fn(db, param);
      await db.close();
      return result;
    } catch (error) {
      console.error("Database operation failed:", error);
      throw error;
    }
  };
}
