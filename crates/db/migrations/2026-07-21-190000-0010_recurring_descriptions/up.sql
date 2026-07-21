PRAGMA foreign_keys = OFF;

DROP INDEX recurring_transactions_visible_name_unique;

ALTER TABLE recurring_occurrences RENAME TO recurring_occurrences_old;
ALTER TABLE recurring_template_revisions RENAME TO recurring_template_revisions_old;

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
    old.id,
    old.recurring_transaction_id,
    old.sequence,
    old.effective_from_local,
    old.effective_until_local,
    COALESCE(NULLIF(trim(old.description), ''), (
        SELECT trim(recurring_transactions.name)
        FROM recurring_transactions
        WHERE recurring_transactions.id = old.recurring_transaction_id
    )),
    old.amount,
    old.transaction_type,
    old.transaction_category_id,
    old.notes
FROM recurring_template_revisions_old AS old;

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

ALTER TABLE recurring_transactions DROP COLUMN name;

PRAGMA foreign_keys = ON;

CREATE TABLE __migration_assert (
    ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0
    ELSE 1
END;

DELETE FROM __migration_assert;

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN (SELECT quick_check FROM pragma_quick_check LIMIT 1) = 'ok' THEN 1
    ELSE 0
END;

DROP TABLE __migration_assert;
