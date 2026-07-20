pub(super) const RENAME_LEGACY_TABLES: &str = "
ALTER TABLE budget_period_results RENAME TO budget_period_results_old;
ALTER TABLE budget_configurations RENAME TO budget_configurations_old;
ALTER TABLE budgets RENAME TO budgets_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE domain_alerts RENAME TO domain_alerts_old;
";

pub(super) const CREATE_REBUILT_TABLES: &str = "
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
    deleted_at TIMESTAMP,
    time_zone TEXT NOT NULL CHECK (length(trim(time_zone)) > 0)
);

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
    deleted_at TIMESTAMP,
    revision BIGINT NOT NULL DEFAULT 0,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    time_zone TEXT NOT NULL CHECK (length(trim(time_zone)) > 0)
);

CREATE TABLE budget_configurations (
    budget_id TEXT NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    category_ids TEXT NOT NULL DEFAULT '[]',
    base_allowance BIGINT NOT NULL CHECK (base_allowance >= 0),
    measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('spending', 'netCashFlow')),
    rollover_mode TEXT NOT NULL CHECK (rollover_mode IN ('off', 'previousPeriodOnly', 'cumulative')),
    warning_percentage INTEGER CHECK (
        warning_percentage IS NULL OR warning_percentage BETWEEN 1 AND 100
    ),
    PRIMARY KEY (budget_id, period_start)
);

CREATE TABLE budget_period_results (
    budget_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    net_budget_spending BIGINT NOT NULL,
    effective_allowance BIGINT NOT NULL,
    remaining_allowance BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('onTrack', 'warning', 'overspent')),
    PRIMARY KEY (budget_id, period_start),
    FOREIGN KEY (budget_id, period_start)
        REFERENCES budget_configurations (budget_id, period_start)
        ON DELETE CASCADE
);

CREATE TABLE domain_alerts (
    id TEXT NOT NULL PRIMARY KEY,
    producer_key TEXT NOT NULL CHECK (length(trim(producer_key)) > 0),
    occurrence_key TEXT NOT NULL CHECK (length(trim(occurrence_key)) > 0),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    destination TEXT,
    data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);
";

pub(super) const DROP_LEGACY_TABLES: &str = "
DROP TABLE budget_period_results_old;
DROP TABLE budget_configurations_old;
DROP TABLE budgets_old;
DROP TABLE transactions_old;
DROP TABLE domain_alerts_old;
";

pub(super) const CREATE_REBUILT_INDEXES: &str = "
CREATE INDEX transactions_type_index ON transactions (transaction_type);
CREATE INDEX transaction_categories_id_index ON transactions (transaction_category_id);
CREATE INDEX transactions_active_date_index
ON transactions (transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_active_category_date_index
ON transactions (transaction_category_id, transaction_date DESC) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX budgets_active_name_unique
ON budgets (lower(trim(name)))
WHERE deleted_at IS NULL;
CREATE INDEX budget_period_results_budget_period_index
ON budget_period_results (budget_id, period_start DESC);

CREATE UNIQUE INDEX domain_alerts_producer_occurrence_unique
ON domain_alerts (producer_key, occurrence_key);
CREATE INDEX domain_alerts_canonical_traversal_index
ON domain_alerts (created_at DESC, id DESC);
CREATE INDEX domain_alerts_unread_lookup_index
ON domain_alerts (read_at)
WHERE read_at IS NULL;
CREATE INDEX domain_alerts_needs_attention_index
ON domain_alerts (created_at DESC, id DESC)
WHERE resolved_at IS NULL;
";

pub(super) const CREATE_RECURRING_TABLES: &str = "
CREATE TABLE recurring_transactions (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    lifecycle TEXT NOT NULL CHECK (
        lifecycle IN ('active', 'paused', 'stopped', 'completed', 'tombstoned')
    ),
    finite_count INTEGER CHECK (finite_count IS NULL OR finite_count > 0),
    fulfilled_count INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_count >= 0),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paused_at TIMESTAMP,
    stopped_at TIMESTAMP,
    completed_at TIMESTAMP,
    tombstoned_at TIMESTAMP,
    CHECK (finite_count IS NULL OR fulfilled_count <= finite_count),
    CHECK (
        CASE lifecycle
            WHEN 'active' THEN paused_at IS NULL AND stopped_at IS NULL
                AND completed_at IS NULL AND tombstoned_at IS NULL
            WHEN 'paused' THEN paused_at IS NOT NULL AND stopped_at IS NULL
                AND completed_at IS NULL AND tombstoned_at IS NULL
            WHEN 'stopped' THEN stopped_at IS NOT NULL
                AND completed_at IS NULL AND tombstoned_at IS NULL
            WHEN 'completed' THEN completed_at IS NOT NULL
                AND stopped_at IS NULL AND tombstoned_at IS NULL
            WHEN 'tombstoned' THEN tombstoned_at IS NOT NULL
            ELSE 0
        END
    )
);
CREATE UNIQUE INDEX recurring_transactions_active_name_unique
ON recurring_transactions (lower(trim(name)))
WHERE tombstoned_at IS NULL;

CREATE TABLE recurring_schedule_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id) ON DELETE CASCADE,
    effective_from_utc TIMESTAMP NOT NULL,
    effective_until_utc TIMESTAMP,
    recurrence_kind TEXT NOT NULL CHECK (recurrence_kind IN ('interval', 'monthly_day')),
    interval_unit TEXT CHECK (
        interval_unit IS NULL OR interval_unit IN ('day', 'week', 'month', 'year')
    ),
    interval_count INTEGER CHECK (interval_count IS NULL OR interval_count > 0),
    monthly_day INTEGER CHECK (monthly_day IS NULL OR monthly_day BETWEEN 1 AND 31),
    zone TEXT NOT NULL CHECK (length(trim(zone)) > 0),
    anchor_local_date TEXT NOT NULL,
    anchor_local_time TEXT NOT NULL,
    CHECK (effective_until_utc IS NULL OR effective_until_utc > effective_from_utc),
    CHECK (
        CASE recurrence_kind
            WHEN 'interval' THEN interval_unit IS NOT NULL
                AND interval_count IS NOT NULL AND monthly_day IS NULL
            WHEN 'monthly_day' THEN monthly_day IS NOT NULL
                AND interval_unit IS NULL AND interval_count IS NULL
            ELSE 0
        END
    )
);
CREATE UNIQUE INDEX recurring_schedule_revisions_open_unique
ON recurring_schedule_revisions (recurring_transaction_id)
WHERE effective_until_utc IS NULL;
CREATE INDEX recurring_schedule_revisions_source_from_index
ON recurring_schedule_revisions (recurring_transaction_id, effective_from_utc);

CREATE TABLE recurring_template_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id) ON DELETE CASCADE,
    effective_from_utc TIMESTAMP NOT NULL,
    effective_until_utc TIMESTAMP,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    transaction_category_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
    description TEXT,
    notes TEXT,
    CHECK (effective_until_utc IS NULL OR effective_until_utc > effective_from_utc)
);
CREATE UNIQUE INDEX recurring_template_revisions_open_unique
ON recurring_template_revisions (recurring_transaction_id)
WHERE effective_until_utc IS NULL;
CREATE INDEX recurring_template_revisions_source_from_index
ON recurring_template_revisions (recurring_transaction_id, effective_from_utc);

CREATE TABLE recurring_occurrence_heads (
    recurring_transaction_id TEXT NOT NULL PRIMARY KEY
        REFERENCES recurring_transactions (id) ON DELETE CASCADE,
    schedule_revision_id TEXT NOT NULL REFERENCES recurring_schedule_revisions (id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    due_at_utc TIMESTAMP NOT NULL
);
CREATE INDEX recurring_occurrence_heads_due_index
ON recurring_occurrence_heads (due_at_utc, recurring_transaction_id);

CREATE TABLE recurring_occurrences (
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id) ON DELETE CASCADE,
    schedule_revision_id TEXT NOT NULL REFERENCES recurring_schedule_revisions (id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    template_revision_id TEXT NOT NULL REFERENCES recurring_template_revisions (id),
    intended_local_date TEXT NOT NULL,
    intended_local_time TEXT NOT NULL,
    zone TEXT NOT NULL CHECK (length(trim(zone)) > 0),
    resolved_at_utc TIMESTAMP NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('generated', 'adopted', 'skipped')),
    fulfilled_at TIMESTAMP,
    fulfillment_position INTEGER CHECK (
        fulfillment_position IS NULL OR fulfillment_position >= 1
    ),
    transaction_id TEXT REFERENCES transactions (id),
    alert_id TEXT REFERENCES domain_alerts (id),
    PRIMARY KEY (recurring_transaction_id, schedule_revision_id, ordinal),
    CHECK (
        CASE kind
            WHEN 'skipped' THEN transaction_id IS NULL AND alert_id IS NULL
                AND fulfilled_at IS NULL AND fulfillment_position IS NULL
            WHEN 'adopted' THEN transaction_id IS NOT NULL AND fulfilled_at IS NOT NULL
                AND fulfillment_position IS NOT NULL AND alert_id IS NULL
            WHEN 'generated' THEN transaction_id IS NOT NULL AND fulfilled_at IS NOT NULL
                AND fulfillment_position IS NOT NULL
            ELSE 0
        END
    )
);
CREATE UNIQUE INDEX recurring_occurrences_transaction_unique
ON recurring_occurrences (transaction_id)
WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX recurring_occurrences_fulfillment_unique
ON recurring_occurrences (recurring_transaction_id, fulfillment_position)
WHERE fulfillment_position IS NOT NULL;
CREATE UNIQUE INDEX recurring_occurrences_alert_unique
ON recurring_occurrences (alert_id)
WHERE alert_id IS NOT NULL;
CREATE INDEX recurring_occurrences_source_feed_index
ON recurring_occurrences (
    recurring_transaction_id, resolved_at_utc DESC, schedule_revision_id, ordinal
);
CREATE INDEX recurring_occurrences_provenance_index
ON recurring_occurrences (recurring_transaction_id, fulfillment_position)
WHERE fulfillment_position IS NOT NULL;
CREATE INDEX recurring_transactions_feed_index
ON recurring_transactions (updated_at DESC, id)
WHERE tombstoned_at IS NULL;

CREATE TABLE recurring_generation_failures (
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id) ON DELETE CASCADE,
    schedule_revision_id TEXT NOT NULL REFERENCES recurring_schedule_revisions (id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    correlation_id TEXT NOT NULL CHECK (length(trim(correlation_id)) > 0),
    redacted_error_code TEXT NOT NULL,
    redacted_error_message TEXT NOT NULL,
    failed_intended_local_date TEXT NOT NULL,
    failed_intended_local_time TEXT NOT NULL,
    failed_zone TEXT NOT NULL CHECK (length(trim(failed_zone)) > 0),
    failed_resolved_at_utc TIMESTAMP,
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    repair_metadata TEXT,
    resolution_metadata TEXT,
    resolved_at TIMESTAMP,
    failure_alert_id TEXT REFERENCES domain_alerts (id),
    PRIMARY KEY (recurring_transaction_id, schedule_revision_id, ordinal)
);
CREATE UNIQUE INDEX recurring_generation_failures_unresolved_unique
ON recurring_generation_failures (recurring_transaction_id)
WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX recurring_generation_failures_alert_unique
ON recurring_generation_failures (failure_alert_id)
WHERE failure_alert_id IS NOT NULL;
CREATE INDEX recurring_generation_failures_history_index
ON recurring_generation_failures (
    recurring_transaction_id, created_at DESC, schedule_revision_id, ordinal
);
";
