PRAGMA foreign_keys = OFF;
BEGIN;
DROP TABLE IF EXISTS "__diesel_schema_migrations";
CREATE TABLE __diesel_schema_migrations (
       version VARCHAR(50) PRIMARY KEY NOT NULL,
       run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP TABLE IF EXISTS "budget_configurations";
CREATE TABLE budget_configurations (
    budget_id TEXT NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    category_ids TEXT NOT NULL DEFAULT '[]',
    base_allowance BIGINT NOT NULL CHECK (base_allowance >= 0),
    measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('spending', 'netCashFlow')),
    rollover_mode TEXT NOT NULL CHECK (rollover_mode IN ('off', 'previousPeriodOnly', 'cumulative')),
    warning_percentage INTEGER CHECK (
        warning_percentage IS NULL OR warning_percentage BETWEEN 1 AND 100
    ),
    PRIMARY KEY (budget_id, period_start)
);
DROP TABLE IF EXISTS "budget_period_results";
CREATE TABLE budget_period_results (
    budget_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    net_budget_spending BIGINT NOT NULL,
    effective_allowance BIGINT NOT NULL,
    remaining_allowance BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('onTrack', 'warning', 'overspent')),
    PRIMARY KEY (budget_id, period_start),
    FOREIGN KEY (budget_id, period_start)
        REFERENCES budget_configurations (budget_id, period_start)
        ON DELETE CASCADE
);
DROP TABLE IF EXISTS "budgets";
CREATE TABLE budgets (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('day', 'week', 'month', 'year')),
    measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('spending', 'netCashFlow')),
    base_allowance BIGINT NOT NULL CHECK (base_allowance >= 0),
    rollover_mode TEXT NOT NULL CHECK (rollover_mode IN ('off', 'previousPeriodOnly', 'cumulative')),
    warning_percentage INTEGER CHECK (
        warning_percentage IS NULL OR warning_percentage BETWEEN 1 AND 100
    ),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
, revision BIGINT NOT NULL DEFAULT 0);
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
    , role TEXT NOT NULL DEFAULT 'spending');
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
DROP INDEX IF EXISTS "budget_period_results_budget_period_index";
CREATE INDEX budget_period_results_budget_period_index
ON budget_period_results (budget_id, period_start DESC);
DROP INDEX IF EXISTS "budgets_active_name_unique";
CREATE UNIQUE INDEX budgets_active_name_unique
ON budgets (lower(trim(name)))
WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS "transaction_categories_child_name_unique";
CREATE UNIQUE INDEX transaction_categories_child_name_unique
ON transaction_categories (parent_id, lower(trim(name)))
WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
DROP INDEX IF EXISTS "transaction_categories_id_index";
CREATE INDEX transaction_categories_id_index ON transactions (transaction_category_id);
DROP INDEX IF EXISTS "transaction_categories_root_name_unique";
CREATE UNIQUE INDEX transaction_categories_root_name_unique
ON transaction_categories (lower(trim(name)))
WHERE parent_id IS NULL AND deleted_at IS NULL;
DROP INDEX IF EXISTS "transactions_active_category_date_index";
CREATE INDEX transactions_active_category_date_index ON transactions (transaction_category_id, transaction_date DESC) WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS "transactions_active_date_index";
CREATE INDEX transactions_active_date_index ON transactions (transaction_date DESC) WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS "transactions_type_index";
CREATE INDEX transactions_type_index ON transactions (transaction_type);
INSERT INTO __diesel_schema_migrations (version) VALUES ('202509260654000000');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607051915000001');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607081806000002');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607120900000003');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607121000000004');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607121200000005');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607121800000006');
COMMIT;
PRAGMA foreign_keys = ON;