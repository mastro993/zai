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
