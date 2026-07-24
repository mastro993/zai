-- Synthetic finance, alert, and recurring rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-recurring', 'Recurring', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO transactions (
    id,
    description,
    amount,
    transaction_date,
    transaction_type,
    transaction_category_id,
    created_at,
    updated_at
)
VALUES (
    'txn-recurring-fixture',
    'Recurring fixture transaction',
    1234,
    '2026-07-20 09:00:00',
    'expense',
    'cat-recurring',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO domain_alerts (
    id,
    producer_key,
    occurrence_key,
    severity,
    title,
    body,
    destination,
    data,
    created_at,
    updated_at,
    read_at,
    resolved_at
)
VALUES (
    'alert-recurring-fixture',
    'release.fixture',
    'fixture-1',
    'info',
    'Recurring fixture alert',
    'Synthetic alert retained at current schema',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL,
    NULL
);

INSERT INTO recurring_transactions (
    id,
    lifecycle,
    total_occurrences,
    fulfilled_count,
    revision,
    lifecycle_changed_at,
    created_at,
    updated_at
)
VALUES (
    'rt-released-fixture',
    'active',
    3,
    0,
    1,
    '2026-07-20 09:00:00',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO recurring_schedule_revisions (
    id,
    recurring_transaction_id,
    sequence,
    effective_from_local,
    first_scheduled_local,
    interval_every,
    interval_unit
)
VALUES (
    'sched-released-fixture-1',
    'rt-released-fixture',
    1,
    '2026-07-20 09:00:00',
    '2026-07-20 09:00:00',
    1,
    'month'
);

INSERT INTO recurring_template_revisions (
    id,
    recurring_transaction_id,
    sequence,
    effective_from_local,
    description,
    amount,
    transaction_type,
    transaction_category_id
)
VALUES (
    'tmpl-released-fixture-1',
    'rt-released-fixture',
    1,
    '2026-07-20 09:00:00',
    'Released recurring fixture',
    1234,
    'expense',
    'cat-recurring'
);

INSERT INTO recurring_occurrence_heads (
    recurring_transaction_id,
    schedule_revision_id,
    next_ordinal,
    next_scheduled_local
)
VALUES (
    'rt-released-fixture',
    'sched-released-fixture-1',
    1,
    '2026-07-20 09:00:00'
);
