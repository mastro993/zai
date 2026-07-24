PRAGMA foreign_keys = OFF;
BEGIN;
DROP TABLE IF EXISTS "__diesel_schema_migrations";
CREATE TABLE __diesel_schema_migrations (
       version VARCHAR(50) PRIMARY KEY NOT NULL,
       run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP TABLE IF EXISTS "transaction_categories";
CREATE TABLE transaction_categories (
        id TEXT NOT NULL PRIMARY KEY,
        parent_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );
DROP TABLE IF EXISTS "transactions";
CREATE TABLE transactions (
        id TEXT NOT NULL PRIMARY KEY,
        description TEXT,
        amount INTEGER NOT NULL,
        transaction_date TIMESTAMP NOT NULL,
        transaction_type TEXT NOT NULL,
        transaction_category_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );
DROP INDEX IF EXISTS "transaction_categories_id_index";
CREATE INDEX transaction_categories_id_index ON transactions (transaction_category_id);
DROP INDEX IF EXISTS "transactions_type_index";
CREATE INDEX transactions_type_index ON transactions (transaction_type);
INSERT INTO __diesel_schema_migrations (version) VALUES ('202509260654000000');
COMMIT;
PRAGMA foreign_keys = ON;