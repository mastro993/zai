DROP INDEX IF EXISTS budgets_active_name_unique;

CREATE TABLE IF NOT EXISTS budgets (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'yearly')),
    first_period_start DATE NOT NULL,
    deactivated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    budget_id TEXT NOT NULL REFERENCES budgets (id),
    effective_period_start DATE NOT NULL,
    allowance INTEGER NOT NULL CHECK (allowance >= 0),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE (budget_id, effective_period_start)
);

CREATE TABLE IF NOT EXISTS budget_revision_scopes (
    revision_id TEXT NOT NULL REFERENCES budget_revisions (id),
    category_id TEXT NOT NULL REFERENCES transaction_categories (id),
    PRIMARY KEY (revision_id, category_id)
);

ALTER TABLE budget_revision_scopes RENAME TO budget_revision_scopes_legacy_0004;
ALTER TABLE budget_revisions RENAME TO budget_revisions_legacy_0004;
ALTER TABLE budgets RENAME TO budgets_legacy_0004;

CREATE TABLE budgets (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence = 'month'),
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

INSERT INTO budgets (
    id,
    name,
    cadence,
    measurement_mode,
    base_allowance,
    rollover_mode,
    warning_percentage,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    budget.id,
    budget.name,
    CASE
        WHEN budget.cadence IN ('daily', 'day') THEN 'day'
        WHEN budget.cadence IN ('weekly', 'week') THEN 'week'
        WHEN budget.cadence IN ('yearly', 'year') THEN 'year'
        ELSE 'month'
    END,
    'spending',
    COALESCE(
        (
            SELECT revision.allowance
            FROM budget_revisions_legacy_0004 AS revision
            WHERE revision.budget_id = budget.id
            ORDER BY revision.effective_period_start DESC
            LIMIT 1
        ),
        0
    ),
    'off',
    NULL,
    budget.created_at,
    budget.updated_at,
    budget.deactivated_at
FROM budgets_legacy_0004 AS budget;

CREATE UNIQUE INDEX budgets_active_name_unique
ON budgets (lower(trim(name)))
WHERE deleted_at IS NULL;

CREATE TABLE budget_configurations (
    budget_id TEXT NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    category_ids TEXT NOT NULL DEFAULT '[]',
    base_allowance BIGINT NOT NULL CHECK (base_allowance >= 0),
    measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('spending', 'netCashFlow')),
    rollover_mode TEXT NOT NULL CHECK (rollover_mode = 'off'),
    warning_percentage INTEGER CHECK (
        warning_percentage IS NULL OR warning_percentage BETWEEN 1 AND 100
    ),
    PRIMARY KEY (budget_id, period_start)
);

INSERT INTO budget_configurations (
    budget_id,
    period_start,
    period_end,
    category_ids,
    base_allowance,
    measurement_mode,
    rollover_mode,
    warning_percentage
)
SELECT
    revision.budget_id,
    datetime(revision.effective_period_start),
    CASE
        WHEN budget.cadence IN ('daily', 'day')
            THEN datetime(revision.effective_period_start, '+1 day')
        WHEN budget.cadence IN ('weekly', 'week')
            THEN datetime(revision.effective_period_start, '+7 days')
        WHEN budget.cadence IN ('yearly', 'year')
            THEN datetime(revision.effective_period_start, '+1 year')
        ELSE datetime(revision.effective_period_start, '+1 month')
    END,
    COALESCE(
        (
            SELECT json_group_array(scope.category_id)
            FROM budget_revision_scopes_legacy_0004 AS scope
            WHERE scope.revision_id = revision.id
        ),
        '[]'
    ),
    revision.allowance,
    'spending',
    'off',
    NULL
FROM budget_revisions_legacy_0004 AS revision
JOIN budgets_legacy_0004 AS budget ON budget.id = revision.budget_id;

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

CREATE INDEX budget_period_results_budget_period_index
ON budget_period_results (budget_id, period_start DESC);

DROP TABLE budget_revision_scopes_legacy_0004;
DROP TABLE budget_revisions_legacy_0004;
DROP TABLE budgets_legacy_0004;
