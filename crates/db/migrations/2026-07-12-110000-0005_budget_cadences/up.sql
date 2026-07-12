PRAGMA foreign_keys = OFF;

DROP INDEX budgets_active_name_unique;

CREATE TABLE budgets_with_cadences (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('day', 'week', 'month', 'year')),
    measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('spending', 'netCashFlow')),
    base_allowance BIGINT NOT NULL CHECK (base_allowance >= 0),
    rollover_mode TEXT NOT NULL CHECK (rollover_mode = 'off'),
    warning_percentage INTEGER CHECK (
        warning_percentage IS NULL OR warning_percentage BETWEEN 1 AND 100
    ),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

INSERT INTO budgets_with_cadences
SELECT id, name, cadence, measurement_mode, base_allowance, rollover_mode,
       warning_percentage, created_at, updated_at, deleted_at
FROM budgets;

DROP TABLE budgets;
ALTER TABLE budgets_with_cadences RENAME TO budgets;

CREATE UNIQUE INDEX budgets_active_name_unique
ON budgets (lower(trim(name)))
WHERE deleted_at IS NULL;

PRAGMA foreign_keys = ON;
