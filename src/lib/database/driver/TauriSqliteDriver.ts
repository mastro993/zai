import TauriDatabase from "@tauri-apps/plugin-sql";
import { CompiledQuery, DatabaseConnection, Driver, QueryResult } from "kysely";
import { TauriSqliteDialectConfig } from "./TauriSqliteDialectConfig";

export class TauriSqliteDriver implements Driver {
  readonly #config: TauriSqliteDialectConfig;
  readonly #connectionMutex = new ConnectionMutex();

  #db?: TauriDatabase;
  #connection?: DatabaseConnection;

  constructor(config: TauriSqliteDialectConfig) {
    this.#config = Object.freeze({ ...config });
  }

  async init(): Promise<void> {
    this.#db =
      typeof this.#config.database === "function"
        ? await this.#config.database()
        : this.#config.database;

    this.#connection = new SqliteConnection(this.#db);

    if (this.#config.onCreateConnection) {
      await this.#config.onCreateConnection(this.#connection);
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    await this.#connectionMutex.lock();
    return this.#connection!;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }

  async releaseConnection(): Promise<void> {
    this.#connectionMutex.unlock();
  }

  async destroy(): Promise<void> {
    this.#db?.close();
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #db: TauriDatabase;

  constructor(db: TauriDatabase) {
    this.#db = db;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery;

    if (sql.toLowerCase().includes("select")) {
      const result = await this.#db.select(sql, [...parameters]);

      // Check if result is an array
      if (Array.isArray(result)) {
        return Promise.resolve({
          numUpdatedOrDeletedRows: BigInt(result.length),
          numAffectedRows: BigInt(result.length),
          insertId: undefined,
          rows: result,
        });
      }

      return Promise.resolve({
        numUpdatedOrDeletedRows: BigInt(0),
        numAffectedRows: BigInt(0),
        insertId: undefined,
        rows: [result] as O[],
      });
    }

    const { lastInsertId, rowsAffected } = await this.#db.execute(sql, [
      ...parameters,
    ]);

    return Promise.resolve({
      numUpdatedOrDeletedRows: BigInt(rowsAffected),
      numAffectedRows: BigInt(rowsAffected),
      insertId: lastInsertId ? BigInt(lastInsertId) : undefined,
      rows: [],
    });
  }

  async *streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize: number
  ): AsyncIterableIterator<QueryResult<R>> {
    console.debug("🔍 Streaming query", _compiledQuery, _chunkSize);
    throw new Error("Stream query is not supported for TauriSqliteDriver");
  }
}

class ConnectionMutex {
  #promise?: Promise<void>;
  #resolve?: () => void;

  async lock(): Promise<void> {
    while (this.#promise) {
      await this.#promise;
    }

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  unlock(): void {
    const resolve = this.#resolve;

    this.#promise = undefined;
    this.#resolve = undefined;

    resolve?.();
  }
}
