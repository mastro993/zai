PRAGMA foreign_keys = OFF;

ALTER TABLE recurring_occurrences RENAME TO recurring_occurrences_old;
ALTER TABLE recurring_template_revisions RENAME TO recurring_template_revisions_old;

CREATE TABLE recurring_template_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    recurring_transaction_id TEXT NOT NULL REFERENCES recurring_transactions (id),
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    effective_from_local TIMESTAMP NOT NULL,
    effective_until_local TIMESTAMP,
    description TEXT,
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

INSERT INTO recurring_template_revisions (
    id,
    recurring_transaction_id,
    sequence,
    effective_from_local,
    effective_until_local,
    description,
    amount,
    transaction_type,
    transaction_category_id,
    notes
)
SELECT
    id,
    recurring_transaction_id,
    sequence,
    effective_from_local,
    effective_until_local,
    description,
    amount,
    transaction_type,
    transaction_category_id,
    notes
FROM recurring_template_revisions_old;

DROP TABLE recurring_template_revisions_old;

CREATE UNIQUE INDEX recurring_template_revisions_open_unique
ON recurring_template_revisions (recurring_transaction_id)
WHERE effective_until_local IS NULL;

CREATE INDEX recurring_template_revisions_effective_lookup_index
ON recurring_template_revisions (
    recurring_transaction_id,
    effective_from_local,
    sequence
);

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

INSERT INTO recurring_occurrences (
    recurring_transaction_id,
    schedule_revision_id,
    ordinal,
    scheduled_local,
    template_revision_id,
    fulfilled_at,
    fulfillment_position,
    transaction_id,
    fulfillment_kind,
    recurring_alert_id
)
SELECT
    recurring_transaction_id,
    schedule_revision_id,
    ordinal,
    scheduled_local,
    template_revision_id,
    fulfilled_at,
    fulfillment_position,
    transaction_id,
    fulfillment_kind,
    recurring_alert_id
FROM recurring_occurrences_old;

DROP TABLE recurring_occurrences_old;

CREATE INDEX recurring_occurrences_history_index
ON recurring_occurrences (
    recurring_transaction_id,
    scheduled_local DESC,
    schedule_revision_id DESC,
    ordinal DESC
);

ALTER TABLE recurring_transactions
ADD COLUMN name TEXT NOT NULL DEFAULT 'Recurring transaction'
CHECK (length(trim(name)) > 0);

UPDATE recurring_transactions
SET name = (
    SELECT trim(description) || ' · ' || recurring_transactions.id
    FROM recurring_template_revisions
    WHERE recurring_template_revisions.recurring_transaction_id = recurring_transactions.id
      AND recurring_template_revisions.effective_until_local IS NULL
);

CREATE UNIQUE INDEX recurring_transactions_visible_name_unique
ON recurring_transactions (lower(trim(name)))
WHERE deleted_at IS NULL;

PRAGMA foreign_keys = ON;
