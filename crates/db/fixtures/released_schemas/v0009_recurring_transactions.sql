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
, revision BIGINT NOT NULL DEFAULT 0, paused BOOLEAN NOT NULL DEFAULT FALSE);
DROP TABLE IF EXISTS "domain_alerts";
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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    resolved_at TIMESTAMP
);
DROP TABLE IF EXISTS "recurring_generation_failures";
CREATE TABLE recurring_generation_failures (
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id),
    schedule_revision_id TEXT NOT NULL
        REFERENCES recurring_schedule_revisions (id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    error_code TEXT NOT NULL CHECK (length(trim(error_code)) > 0),
    cause_category TEXT NOT NULL CHECK (length(trim(cause_category)) > 0),
    repair_field_key TEXT,
    correlation_id TEXT NOT NULL CHECK (length(trim(correlation_id)) > 0),
    failed_scheduled_local TIMESTAMP NOT NULL,
    first_failed_at TIMESTAMP NOT NULL,
    last_failed_at TIMESTAMP NOT NULL,
    attempt_count INTEGER NOT NULL CHECK (attempt_count >= 1),
    repaired_at TIMESTAMP,
    repair_revision INTEGER CHECK (
        repair_revision IS NULL OR repair_revision >= 1
    ),
    resolved_at TIMESTAMP,
    resolution_kind TEXT,
    generation_failure_alert_id TEXT NOT NULL UNIQUE
        REFERENCES domain_alerts (id),
    PRIMARY KEY (
        recurring_transaction_id,
        schedule_revision_id,
        ordinal
    ),
    CHECK (
        (resolved_at IS NULL AND resolution_kind IS NULL)
        OR (
            resolved_at IS NOT NULL
            AND resolution_kind IS NOT NULL
            AND length(trim(resolution_kind)) > 0
        )
    ),
    CHECK (
        (repaired_at IS NULL AND repair_revision IS NULL)
        OR (repaired_at IS NOT NULL AND repair_revision IS NOT NULL)
    )
);
DROP TABLE IF EXISTS "recurring_occurrence_heads";
CREATE TABLE recurring_occurrence_heads (
    recurring_transaction_id TEXT NOT NULL PRIMARY KEY
        REFERENCES recurring_transactions (id),
    schedule_revision_id TEXT NOT NULL
        REFERENCES recurring_schedule_revisions (id),
    next_ordinal INTEGER NOT NULL CHECK (next_ordinal >= 1),
    next_scheduled_local TIMESTAMP NOT NULL
);
DROP TABLE IF EXISTS "recurring_occurrences";
CREATE TABLE recurring_occurrences (
    recurring_transaction_id TEXT NOT NULL
        REFERENCES recurring_transactions (id),
    schedule_revision_id TEXT NOT NULL
        REFERENCES recurring_schedule_revisions (id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
    scheduled_local TIMESTAMP NOT NULL,
    template_revision_id TEXT NOT NULL
        REFERENCES recurring_template_revisions (id),
    fulfilled_at TIMESTAMP NOT NULL,
    fulfillment_position INTEGER NOT NULL CHECK (fulfillment_position >= 1),
    transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions (id),
    fulfillment_kind TEXT NOT NULL CHECK (
        fulfillment_kind IN ('generated', 'adopted')
    ),
    recurring_alert_id TEXT UNIQUE REFERENCES domain_alerts (id),
    PRIMARY KEY (
        recurring_transaction_id,
        schedule_revision_id,
        ordinal
    ),
    UNIQUE (recurring_transaction_id, fulfillment_position),
    CHECK (
        (
            fulfillment_kind = 'generated'
            AND recurring_alert_id IS NOT NULL
        )
        OR (
            fulfillment_kind = 'adopted'
            AND recurring_alert_id IS NULL
        )
    )
);
DROP TABLE IF EXISTS "recurring_schedule_revisions";
CREATE TABLE recurring_schedule_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    recurring_transaction_id TEXT NOT NULL REFERENCES recurring_transactions (id),
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    effective_from_local TIMESTAMP NOT NULL,
    effective_until_local TIMESTAMP,
    first_scheduled_local TIMESTAMP NOT NULL,
    interval_every INTEGER CHECK (interval_every IS NULL OR interval_every >= 1),
    interval_unit TEXT CHECK (
        interval_unit IS NULL
        OR interval_unit IN ('day', 'week', 'month', 'year')
    ),
    monthly_day INTEGER CHECK (
        monthly_day IS NULL OR monthly_day BETWEEN 1 AND 31
    ),
    CHECK (
        effective_until_local IS NULL
        OR effective_until_local > effective_from_local
    ),
    CHECK (
        (
            interval_every IS NOT NULL
            AND interval_unit IS NOT NULL
            AND monthly_day IS NULL
        )
        OR (
            interval_every IS NULL
            AND interval_unit IS NULL
            AND monthly_day IS NOT NULL
        )
    ),
    UNIQUE (recurring_transaction_id, sequence)
);
DROP TABLE IF EXISTS "recurring_template_revisions";
CREATE TABLE recurring_template_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    recurring_transaction_id TEXT NOT NULL REFERENCES recurring_transactions (id),
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    effective_from_local TIMESTAMP NOT NULL,
    effective_until_local TIMESTAMP,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN ('expense', 'income')
    ),
    transaction_category_id TEXT REFERENCES transaction_categories (id)
        ON DELETE SET NULL,
    notes TEXT,
    CHECK (
        effective_until_local IS NULL
        OR effective_until_local > effective_from_local
    ),
    UNIQUE (recurring_transaction_id, sequence)
);
DROP TABLE IF EXISTS "recurring_transactions";
CREATE TABLE recurring_transactions (
    id TEXT NOT NULL PRIMARY KEY,
    lifecycle TEXT NOT NULL CHECK (
        lifecycle IN ('active', 'paused', 'stopped', 'completed', 'tombstoned')
    ),
    total_occurrences INTEGER CHECK (
        total_occurrences IS NULL OR total_occurrences >= 1
    ),
    fulfilled_count INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_count >= 0),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    lifecycle_changed_at TIMESTAMP NOT NULL,
    paused_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CHECK (
        (lifecycle = 'paused' AND paused_at IS NOT NULL)
        OR (lifecycle <> 'paused' AND paused_at IS NULL)
    ),
    CHECK (
        (lifecycle = 'tombstoned' AND deleted_at IS NOT NULL)
        OR (lifecycle <> 'tombstoned' AND deleted_at IS NULL)
    ),
    CHECK (
        lifecycle <> 'completed'
        OR (
            total_occurrences IS NOT NULL
            AND fulfilled_count = total_occurrences
        )
    ),
    CHECK (
        total_occurrences IS NULL
        OR lifecycle NOT IN ('active', 'paused')
        OR fulfilled_count < total_occurrences
    )
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
DROP INDEX IF EXISTS "domain_alerts_canonical_traversal_index";
CREATE INDEX domain_alerts_canonical_traversal_index
ON domain_alerts (created_at DESC, id DESC);
DROP INDEX IF EXISTS "domain_alerts_producer_occurrence_unique";
CREATE UNIQUE INDEX domain_alerts_producer_occurrence_unique
ON domain_alerts (producer_key, occurrence_key);
DROP INDEX IF EXISTS "domain_alerts_unread_lookup_index";
CREATE INDEX domain_alerts_unread_lookup_index
ON domain_alerts (read_at)
WHERE read_at IS NULL;
DROP INDEX IF EXISTS "domain_alerts_unresolved_lookup_index";
CREATE INDEX domain_alerts_unresolved_lookup_index
ON domain_alerts (resolved_at)
WHERE resolved_at IS NULL;
DROP INDEX IF EXISTS "recurring_generation_failures_history_index";
CREATE INDEX recurring_generation_failures_history_index
ON recurring_generation_failures (
    recurring_transaction_id,
    first_failed_at DESC,
    schedule_revision_id DESC,
    ordinal DESC
);
DROP INDEX IF EXISTS "recurring_generation_failures_open_unique";
CREATE UNIQUE INDEX recurring_generation_failures_open_unique
ON recurring_generation_failures (recurring_transaction_id)
WHERE resolved_at IS NULL;
DROP INDEX IF EXISTS "recurring_generation_failures_unresolved_index";
CREATE INDEX recurring_generation_failures_unresolved_index
ON recurring_generation_failures (
    first_failed_at DESC,
    schedule_revision_id DESC,
    ordinal DESC
)
WHERE resolved_at IS NULL;
DROP INDEX IF EXISTS "recurring_occurrence_heads_due_discovery_index";
CREATE INDEX recurring_occurrence_heads_due_discovery_index
ON recurring_occurrence_heads (
    next_scheduled_local,
    recurring_transaction_id
);
DROP INDEX IF EXISTS "recurring_occurrences_history_index";
CREATE INDEX recurring_occurrences_history_index
ON recurring_occurrences (
    recurring_transaction_id,
    scheduled_local DESC,
    schedule_revision_id DESC,
    ordinal DESC
);
DROP INDEX IF EXISTS "recurring_schedule_revisions_effective_lookup_index";
CREATE INDEX recurring_schedule_revisions_effective_lookup_index
ON recurring_schedule_revisions (
    recurring_transaction_id,
    effective_from_local,
    sequence
);
DROP INDEX IF EXISTS "recurring_schedule_revisions_open_unique";
CREATE UNIQUE INDEX recurring_schedule_revisions_open_unique
ON recurring_schedule_revisions (recurring_transaction_id)
WHERE effective_until_local IS NULL;
DROP INDEX IF EXISTS "recurring_template_revisions_effective_lookup_index";
CREATE INDEX recurring_template_revisions_effective_lookup_index
ON recurring_template_revisions (
    recurring_transaction_id,
    effective_from_local,
    sequence
);
DROP INDEX IF EXISTS "recurring_template_revisions_open_unique";
CREATE UNIQUE INDEX recurring_template_revisions_open_unique
ON recurring_template_revisions (recurring_transaction_id)
WHERE effective_until_local IS NULL;
DROP INDEX IF EXISTS "recurring_transactions_visible_feed_index";
CREATE INDEX recurring_transactions_visible_feed_index
ON recurring_transactions (updated_at DESC, id DESC)
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
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607122000000007');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607141200000008');
INSERT INTO __diesel_schema_migrations (version) VALUES ('202607202100000009');
COMMIT;
PRAGMA foreign_keys = ON;